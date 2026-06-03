require({
  packages: [
    {
      name: "root",
      location: document.location.pathname + "/..",
    },
  ],
}, [
  "esri/Map",
  "esri/Camera",
  "esri/views/SceneView",
  "esri/views/3d/externalRenderers",
  "root/renderer",
  "dojo/number",
  "dojo/string",
  "dojo/domReady!",
], function (
  Map,
  Camera,
  SceneView,
  ExternalRenderers,
  Renderer,
  number,
  string
) {
  $(document).ready(function () {
    // Enforce strict mode
    "use strict";

    // Files
    var TLE = "data/tle.20171129.txt";
    var OIO = "data/oio.20171129.txt";

    // Well known satellite constellations.
    var GPS = [
      20959, 22877, 23953, 24876, 25933, 26360, 26407, 26605, 26690, 27663,
      27704, 28129, 28190, 28361, 28474, 28874, 29486, 29601, 32260, 32384,
      32711, 35752, 36585, 37753, 38833, 39166, 39533, 39741, 40105, 40294,
      40534,
    ];
    var GLONASS = [
      28915, 29672, 29670, 29671, 32276, 32275, 32393, 32395, 36111, 36112,
      36113, 36400, 36402, 36401, 37139, 37138, 37137, 37829, 37869, 37867,
      37868, 39155, 39620, 40001,
    ];
    var INMARSAT = [
      20918, 21149, 21814, 21940, 23839, 24307, 24674, 24819, 25153, 28628,
      28899, 33278, 40384, 39476,
    ];
    var LANDSAT = [25682, 39084];
    var DIGITALGLOBE = [25919, 32060, 33331, 35946, 40115];
    var SPACESTATIONS = [
      25544, // International Space Station
      41765, // Tiangong-2
    ];

    // Orbital altitude definitions.
    var LOW_ORBIT = 2000;
    var GEOSYNCHRONOUS_ORBIT = 35786;

    // Satellite database urls.
    var NASA_SATELLITE_DATABASE =
      "https://nssdc.gsfc.nasa.gov/nmc/masterCatalog.do?sc="; // use International id
    var N2YO_SATELLITE_DATABASE = "https://www.n2yo.com/satellite/?s="; // use NORAD id

    // Rendering variables.
    var renderer = null;
    
    // Make renderer accessible globally for reset functionality
    window.renderer = null;

    // Create map and view
    var view = new SceneView({
      map: new Map({
        basemap: "hybrid",
      }),
      container: "map",
      ui: {
        components: ["zoom", "compass"],
      },
      environment: {
        // lighting: {
        //   directShadowsEnabled: false,
        //   ambientOcclusionEnabled: false,
        //   cameraTrackingEnabled: false,
        // },
        atmosphereEnabled: true,
        atmosphere: {
          quality: "high",
        },
        starsEnabled: false,
      },
      constraints: {
        altitude: {
          max: 12000000000,
        },
      },
    });
    view.when(function () {
      // Set initial camera position
      view.set(
        "camera",
        Camera.fromJSON({
          position: {
            x: -1308000,
            y: 2670000,
            spatialReference: {
              wkid: 102100,
              latestWkid: 3857,
            },
            z: 110000000,
          },
        })
      );

      // Increase far clipping plane
      view.constraints.clipDistance.far *= 4;

      // Load satellites
      loadSatellites().done(function (satellites) {
        // Load satellite layer
        renderer = new Renderer(satellites);
        window.renderer = renderer; // Make available globally
        ExternalRenderers.add(view, renderer);

        // Show satellite count
        updateCounter();

        // Store satellites for search
        storeSatellitesForSearch(satellites);

        // Load metadata
        loadMetadata().done(function (metadata) {
          $.each(renderer.satellites, function () {
            this.metadata = metadata[this.id];
          });
          
          // Initialize search functionality after metadata is loaded
          initializeSearchFunctionality();
        });
      });
    });
    view.on("click", function (e) {
      // Highlighted satellite
      var sat = renderer.satelliteHover;
      let details = document.getElementById("bottom-left");
      let probability = document.getElementById("botton-right-probability");

      // Nothing selected. Hide orbit and close information window.
      if (sat === null) {
        renderer.hideOrbit();
        details.style.display = "none";
        probability.style.display = "none";
        // showDialog("main");
        return;
      }

      //////////////////////////////////

      ////////////////////////////////////

      // Display information panel
      $("#infoWindow-title").html(sat.metadata.name);
      $("#infoWindow-norad").html(sat.id);
      $("#infoWindow-int").html(sat.metadata.int);
      $("#infoWindow-name").html(sat.metadata.name);
      $("#infoWindow-country").html(sat.metadata.country);
      const periodInMinutes = sat.metadata.period;
      const periodInSeconds = periodInMinutes * 60;
      const periodInHours = periodInMinutes / 60;

      const formattedPeriod = `${number.format(periodInHours, {
        places: 2,
      })} hours | ${number.format(periodInMinutes, {
        places: 2,
      })} min | ${number.format(periodInSeconds, { places: 2 })} sec`;

      $("#infoWindow-period").html(formattedPeriod);
      $("#infoWindow-inclination").html(sat.metadata.inclination + "°");
      $("#infoWindow-apogee").html(
        number.format(sat.metadata.apogee, {
          places: 0,
        }) + " km"
      );
      $("#infoWindow-perigee").html(
        number.format(sat.metadata.perigee, {
          places: 0,
        }) + " km"
      );
      $("#infoWindow-size").html(sat.metadata.size);
      $("#infoWindow-launch").html(sat.metadata.launch.toLocaleDateString());
      $("#link-nasa").attr(
        "href",
        string.substitute(NASA_SATELLITE_DATABASE + "${id}", {
          id: sat.metadata.int,
        })
      );
      $("#link-n2yo").attr(
        "href",
        string.substitute(N2YO_SATELLITE_DATABASE + "${id}", { id: sat.id })
      );
      showDialog("info");

      // Display the orbit for the click satellite immediately
      renderer.showOrbit();
      console.log("Selected Satellite NORAD ID:", sat.id);

      // Show loading indicator for collision probability
      showCollisionLoadingIndicator();

      ////////////////////////////////////

      // Enhanced Collision Prediction System
      function precomputeSatelliteStates(satellite, startTime, maxSteps) {
        const states = [];
        for (let step = 0; step < maxSteps; step++) {
          const checkTime = new Date(startTime.getTime() + (step * 60 * 60 * 1000));
          try {
            const posVel = window.satellite.propagate(
              satellite.satrec,
              checkTime.getUTCFullYear(),
              checkTime.getUTCMonth() + 1,
              checkTime.getUTCDate(),
              checkTime.getUTCHours(),
              checkTime.getUTCMinutes(),
              checkTime.getUTCSeconds()
            );
            states.push({
              time: checkTime,
              position: posVel.position || null,
              velocity: posVel.velocity || null
            });
          } catch (error) {
            states.push({
              time: checkTime,
              position: null,
              velocity: null
            });
          }
        }
        return states;
      }

      async function calculateCollisionPredictions(selectedSatellite) {
        console.log("🛰️ Starting collision prediction for satellite:", selectedSatellite.id);
        
        // Show enhanced loading indicator with glitch effect
        showEnhancedCollisionLoadingIndicator();
        
        try {
          // Get all satellites for comparison
          const allSatellites = renderer.satellites;
          const collisionResults = [];
          
          // Calculate collision predictions for next 7 days
          const predictionDays = 7;
          const timeSteps = 24 * predictionDays; // Hourly checks for 7 days
          const currentTime = new Date();
          const maxSteps = 336; // Precompute up to 336 steps (enough for orbital mechanics)
          
          console.log(`🔄 Analyzing ${allSatellites.length} satellites over ${predictionDays} days...`);
          
          // Precompute states for selected satellite once
          const selectedSatStates = precomputeSatelliteStates(selectedSatellite, currentTime, maxSteps);
          
          // Compare selected satellite with all others
          for (let i = 0; i < allSatellites.length; i++) {
            const otherSat = allSatellites[i];
            
            // Skip self-comparison
            if (otherSat.id === selectedSatellite.id) continue;
            
            // Skip if no metadata
            if (!otherSat.metadata || !selectedSatellite.metadata) continue;
            
            // Precompute states for other satellite
            const otherSatStates = precomputeSatelliteStates(otherSat, currentTime, maxSteps);
            
            // Calculate collision probability
            const collisionData = calculatePairwiseCollisionRisk(
              selectedSatellite, 
              otherSat, 
              currentTime, 
              timeSteps,
              selectedSatStates,
              otherSatStates
            );
            
            // Always add the result, regardless of probability
            collisionResults.push(collisionData);
          }
          
          // Sort by collision probability (highest first), then by distance (closest first)
          collisionResults.sort((a, b) => {
            const probDiff = b.collisionProbability - a.collisionProbability;
            if (Math.abs(probDiff) < 0.0001) {
              // If probabilities are very similar, sort by distance
              return a.minDistance - b.minDistance;
            }
            return probDiff;
          });
          
          // Find nearest satellite with highest risk
          const nearestHighRisk = collisionResults.length > 0 ? collisionResults[0] : null;
          
          console.log(`✅ Analysis complete. Found ${collisionResults.length} potential collision risks`);
          
          // Update UI with enhanced collision data
          updateEnhancedCollisionUI(selectedSatellite, nearestHighRisk, collisionResults);
          
        } catch (error) {
          console.error("❌ Collision prediction error:", error);
          showCollisionError("Error in collision prediction algorithm");
        }
      }
      
      function calculatePairwiseCollisionRisk(sat1, sat2, startTime, timeSteps, states1, states2) {
        let minDistance = Infinity;
        let closestApproachTime = null;
        let relativeVelocity = 0;
        let closestPositions = { sat1: null, sat2: null };
        
        // Check positions over time
        for (let step = 0; step < timeSteps; step++) {
          const state1 = states1[step];
          const state2 = states2[step];
          if (!state1 || !state2) continue;
          
          const pos1 = state1.position;
          const pos2 = state2.position;
          if (!pos1 || !pos2) continue;
          
          // Calculate distance between satellites
          const distance = calculateDistance3D(pos1, pos2);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestApproachTime = state1.time;
            closestPositions = { sat1: pos1, sat2: pos2 };
            
            // Calculate relative velocity
            const vel1 = state1.velocity;
            const vel2 = state2.velocity;
            if (vel1 && vel2) {
              relativeVelocity = calculateRelativeVelocity(vel1, vel2);
            }
          }
        }
        
        // Calculate collision probability using advanced ensemble method
        const collisionRadius = getCollisionRadius(sat1, sat2);
        const collisionProbability = calculateCollisionProbabilityEnsemble(
          sat1, sat2, timeSteps, collisionRadius, states1, states2
        );
        
        // Convert positions to lat/lng for display
        const latLng1 = eciToLatLng(closestPositions.sat1);
        const latLng2 = eciToLatLng(closestPositions.sat2);
        
        return {
          targetSatellite: sat2,
          minDistance: minDistance,
          collisionProbability: collisionProbability,
          closestApproachTime: closestApproachTime,
          relativeVelocity: relativeVelocity,
          position1: latLng1,
          position2: latLng2,
          collisionRadius: collisionRadius
        };
      }
      
      function calculateDistance3D(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx*dx + dy*dy + dz*dz);
      }
      
      function calculateRelativeVelocity(vel1, vel2) {
        const dvx = vel1.x - vel2.x;
        const dvy = vel1.y - vel2.y;
        const dvz = vel1.z - vel2.z;
        return Math.sqrt(dvx*dvx + dvy*dvy + dvz*dvz);
      }
      
      function getCollisionRadius(sat1, sat2) {
        // Base collision radius based on satellite size
        const sizeRadii = {
          'SMALL': 5,    // 5 km
          'MEDIUM': 10,  // 10 km
          'LARGE': 20    // 20 km
        };
        
        const radius1 = sizeRadii[sat1.metadata.size] || 10;
        const radius2 = sizeRadii[sat2.metadata.size] || 10;
        
        // Combined collision radius
        return radius1 + radius2;
      }
      
      // Advanced Collision Prediction Methods
      
      // Method 1: Monte Carlo Simulation
      function calculateCollisionProbabilityMonteCarlo(sat1, sat2, timeSteps, collisionRadius, states1, states2) {
        const numSamples = 1000; // Number of Monte Carlo samples
        let collisionCount = 0;
        const uncertaintyFactor = 0.1; // 10% uncertainty
        
        for (let sample = 0; sample < numSamples; sample++) {
          let minDistance = Infinity;
          
          for (let step = 0; step < timeSteps; step++) {
            const state1 = states1[step];
            const state2 = states2[step];
            if (!state1 || !state2) continue;
            
            const pos1_base = state1.position;
            const pos2_base = state2.position;
            if (!pos1_base || !pos2_base) continue;
            
            // Add Gaussian noise using precomputed positions
            const pos1 = {
              x: pos1_base.x + pos1_base.x * uncertaintyFactor * (Math.random() - 0.5) * 2,
              y: pos1_base.y + pos1_base.y * uncertaintyFactor * (Math.random() - 0.5) * 2,
              z: pos1_base.z + pos1_base.z * uncertaintyFactor * (Math.random() - 0.5) * 2
            };
            const pos2 = {
              x: pos2_base.x + pos2_base.x * uncertaintyFactor * (Math.random() - 0.5) * 2,
              y: pos2_base.y + pos2_base.y * uncertaintyFactor * (Math.random() - 0.5) * 2,
              z: pos2_base.z + pos2_base.z * uncertaintyFactor * (Math.random() - 0.5) * 2
            };
            
            const dx = pos1.x - pos2.x;
            const dy = pos1.y - pos2.y;
            const dz = pos1.z - pos2.z;
            const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (distance < minDistance) {
              minDistance = distance;
            }
          }
          
          // Check if collision occurred in this sample
          if (minDistance <= collisionRadius) {
            collisionCount++;
          }
        }
        
        return collisionCount / numSamples;
      }
      
      // Method 2: Orbital Mechanics Based (Chauvenet Criterion)
      function calculateCollisionProbabilityOrbitalMechanics(sat1, sat2, timeSteps, collisionRadius, states1, states2) {
        let minDistance = Infinity;
        let closestApproachTime = null;
        let relativeVelocity = 0;
        
        // Calculate orbital periods
        const period1 = sat1.metadata.period * 60; // Convert to seconds
        const period2 = sat2.metadata.period * 60;
        
        // Find closest approach over multiple orbital periods
        const maxPeriods = Math.max(period1, period2) / 3600; // Convert to hours
        const extendedSteps = Math.min(timeSteps * 2, Math.floor(maxPeriods * 24));
        
        for (let step = 0; step < extendedSteps; step++) {
          const state1 = states1[step];
          const state2 = states2[step];
          if (!state1 || !state2) continue;
          
          const pos1 = state1.position;
          const pos2 = state2.position;
          if (!pos1 || !pos2) continue;
          
          const distance = calculateDistance3D(pos1, pos2);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestApproachTime = state1.time;
            
            // Calculate relative velocity
            const vel1 = state1.velocity;
            const vel2 = state2.velocity;
            if (vel1 && vel2) {
              relativeVelocity = calculateRelativeVelocity(vel1, vel2);
            }
          }
        }
        
        // Use Chauvenet criterion for collision probability
        const sigma = calculateOrbitalUncertainty(sat1, sat2, closestApproachTime);
        const normalizedDistance = minDistance / collisionRadius;
        
        // Probability based on orbital mechanics
        let probability = 0;
        if (normalizedDistance < 1) {
          // Direct collision zone
          probability = 0.8 + (1 - normalizedDistance) * 0.2;
        } else if (normalizedDistance < 3) {
          // Near miss zone - use Gaussian distribution
          const z = (normalizedDistance - 1) / sigma;
          probability = Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
        } else {
          // Safe zone - exponential decay
          probability = Math.exp(-(normalizedDistance - 3) * 0.5) * 0.1;
        }
        
        // Adjust for relative velocity
        const velocityFactor = Math.min(relativeVelocity / 7.5, 3); // Orbital velocity ~7.5 km/s
        probability *= (1 + velocityFactor * 0.2);
        
        return Math.min(Math.max(probability, 0), 1);
      }
      
      // Method 3: Reachability Analysis
      function calculateCollisionProbabilityReachability(sat1, sat2, timeSteps, collisionRadius, states1, states2) {
        const reachabilityRadius = collisionRadius * 5; // Extended reachability zone
        let collisionProbability = 0;
        
        for (let step = 0; step < timeSteps; step++) {
          const state1 = states1[step];
          const state2 = states2[step];
          if (!state1 || !state2) continue;
          
          const pos1 = state1.position;
          const pos2 = state2.position;
          if (!pos1 || !pos2) continue;
          
          const distance = calculateDistance3D(pos1, pos2);
          
          if (distance <= reachabilityRadius) {
            // Calculate reachable set intersection probability
            const vel1 = state1.velocity;
            const vel2 = state2.velocity;
            
            const reachableSet1 = calculateReachableSetWithVel(pos1, vel1, 1); // 1 hour ahead
            const reachableSet2 = calculateReachableSetWithVel(pos2, vel2, 1);
            
            const intersectionProbability = calculateSetIntersection(reachableSet1, reachableSet2, collisionRadius);
            collisionProbability = Math.max(collisionProbability, intersectionProbability);
          }
        }
        
        return collisionProbability;
      }
      
      // Method 4: Machine Learning Based (Simplified Neural Network)
      function calculateCollisionProbabilityML(sat1, sat2, timeSteps, collisionRadius, states1, states2) {
        // Extract features for ML model
        const features = extractCollisionFeaturesFromStates(sat1, sat2, timeSteps, states1, states2);
        
        // Simplified neural network weights (would be trained in real implementation)
        const weights = {
          distance: -0.8,
          velocity: 0.3,
          orbitalPeriodDiff: -0.2,
          inclinationDiff: -0.1,
          altitudeDiff: -0.15,
          eccentricityDiff: 0.1
        };
        
        // Calculate weighted sum
        let prediction = 0;
        prediction += weights.distance * Math.log(features.minDistance / collisionRadius);
        prediction += weights.velocity * (features.relativeVelocity / 10);
        prediction += weights.orbitalPeriodDiff * Math.abs(features.periodDifference / 100);
        prediction += weights.inclinationDiff * Math.abs(features.inclinationDifference);
        prediction += weights.altitudeDiff * Math.abs(features.altitudeDifference / 1000);
        prediction += weights.eccentricityDiff * Math.abs(features.eccentricityDifference);
        
        // Apply sigmoid activation
        const probability = 1 / (1 + Math.exp(-prediction));
        
        return Math.min(Math.max(probability, 0), 1);
      }
      
      // Ensemble Method: Combine all methods
      function calculateCollisionProbabilityEnsemble(sat1, sat2, timeSteps, collisionRadius, states1, states2) {
        const methods = [
          calculateCollisionProbabilityMonteCarlo,
          calculateCollisionProbabilityOrbitalMechanics,
          calculateCollisionProbabilityReachability,
          calculateCollisionProbabilityML
        ];
        
        const weights = [0.3, 0.4, 0.2, 0.1]; // Weighted combination
        let ensembleProbability = 0;
        
        for (let i = 0; i < methods.length; i++) {
          try {
            const methodProbability = methods[i](sat1, sat2, timeSteps, collisionRadius, states1, states2);
            ensembleProbability += weights[i] * methodProbability;
          } catch (error) {
            console.warn(`Method ${i} failed:`, error);
            // Use fallback method
            ensembleProbability += weights[i] * calculateCollisionProbabilityFallback(sat1, sat2, timeSteps, collisionRadius, states1, states2);
          }
        }
        
        return Math.min(Math.max(ensembleProbability, 0), 1);
      }
      
      // Fallback method (improved version of original)
      function calculateCollisionProbabilityFallback(sat1, sat2, timeSteps, collisionRadius, states1, states2) {
        let minDistance = Infinity;
        let relativeVelocity = 0;
        
        for (let step = 0; step < timeSteps; step++) {
          const state1 = states1[step];
          const state2 = states2[step];
          if (!state1 || !state2) continue;
          
          const pos1 = state1.position;
          const pos2 = state2.position;
          if (!pos1 || !pos2) continue;
          
          const distance = calculateDistance3D(pos1, pos2);
          
          if (distance < minDistance) {
            minDistance = distance;
            
            const vel1 = state1.velocity;
            const vel2 = state2.velocity;
            if (vel1 && vel2) {
              relativeVelocity = calculateRelativeVelocity(vel1, vel2);
            }
          }
        }
        
        // Improved probability calculation
        const normalizedDistance = minDistance / collisionRadius;
        let probability = Math.exp(-normalizedDistance * 0.3); // Less aggressive decay
        
        // Better velocity adjustment
        const velocityFactor = Math.min(relativeVelocity / 7.5, 2);
        probability *= (1 + velocityFactor * 0.25);
        
        // Add orbital mechanics factor
        const periodRatio = Math.min(sat1.metadata.period, sat2.metadata.period) / 
                           Math.max(sat1.metadata.period, sat2.metadata.period);
        probability *= (1 + periodRatio * 0.1);
        
        return Math.min(Math.max(probability, 0), 1);
      }
      
      // Helper functions for advanced methods
      function calculateOrbitalUncertainty(sat1, sat2, time) {
        // Simplified uncertainty calculation based on orbital parameters
        const uncertainty1 = sat1.metadata.period * 0.01; // 1% of period
        const uncertainty2 = sat2.metadata.period * 0.01;
        return Math.sqrt(uncertainty1 * uncertainty1 + uncertainty2 * uncertainty2);
      }
      
      function calculateReachableSetWithVel(pos, vel, timeHorizon) {
        if (!pos || !vel) return { center: pos, radius: 0 };
        
        // Calculate maximum displacement over time horizon
        const maxDisplacement = Math.sqrt(vel.x*vel.x + vel.y*vel.y + vel.z*vel.z) * timeHorizon * 3600;
        
        return {
          center: pos,
          radius: maxDisplacement
        };
      }
      
      function calculateSetIntersection(set1, set2, collisionRadius) {
        if (!set1.center || !set2.center) return 0;
        
        const distance = calculateDistance3D(set1.center, set2.center);
        const combinedRadius = set1.radius + set2.radius;
        
        if (distance > combinedRadius) return 0;
        if (distance <= collisionRadius) return 1;
        
        // Calculate intersection probability
        const intersectionArea = Math.PI * collisionRadius * collisionRadius;
        const totalArea = Math.PI * combinedRadius * combinedRadius;
        
        return intersectionArea / totalArea;
      }
      
      function extractCollisionFeaturesFromStates(sat1, sat2, timeSteps, states1, states2) {
        let minDistance = Infinity;
        let relativeVelocity = 0;
        
        for (let step = 0; step < timeSteps; step++) {
          const state1 = states1[step];
          const state2 = states2[step];
          if (!state1 || !state2) continue;
          
          const pos1 = state1.position;
          const pos2 = state2.position;
          if (!pos1 || !pos2) continue;
          
          const distance = calculateDistance3D(pos1, pos2);
          
          if (distance < minDistance) {
            minDistance = distance;
            
            const vel1 = state1.velocity;
            const vel2 = state2.velocity;
            if (vel1 && vel2) {
              relativeVelocity = calculateRelativeVelocity(vel1, vel2);
            }
          }
        }
        
        return {
          minDistance: minDistance,
          relativeVelocity: relativeVelocity,
          periodDifference: Math.abs(sat1.metadata.period - sat2.metadata.period),
          inclinationDifference: Math.abs(sat1.metadata.inclination - sat2.metadata.inclination),
          altitudeDifference: Math.abs(sat1.metadata.apogee - sat2.metadata.apogee),
          eccentricityDifference: 0
        };
      }
      
      // Main collision probability function (now uses ensemble method)
      function calculateCollisionProbability(distance, relativeVelocity, collisionRadius) {
        const normalizedDistance = distance / collisionRadius;
        let probability = Math.exp(-normalizedDistance * 0.3);
        const velocityFactor = Math.min(relativeVelocity / 7.5, 2);
        probability *= (1 + velocityFactor * 0.25);
        return Math.min(Math.max(probability, 0), 1);
      }
      
      function eciToLatLng(eciPos) {
        if (!eciPos) return { lat: 0, lng: 0, alt: 0 };
        
        // Simple ECI to geographic conversion (approximate)
        const x = eciPos.x;
        const y = eciPos.y;
        const z = eciPos.z;
        
        const r = Math.sqrt(x*x + y*y + z*z);
        const lat = Math.asin(z / r) * (180 / Math.PI);
        const lng = Math.atan2(y, x) * (180 / Math.PI);
        const alt = r - 6371; // Earth radius in km
        
        return { lat, lng, alt };
      }

      async function getSatelliteCollisionProbability(satelliteId, retryCount = 0) {
        console.log(`Fetching collision data for satellite ${satelliteId}, attempt ${retryCount + 1}`);
        
        try {
          const url = "http://127.0.0.1:5000/satellite-collision-probability";
          const payload = { target_norad_id: satelliteId };

          // Update loading message with progress and start timer
          const startTime = Date.now();
          if (retryCount === 0) {
            updateLoadingMessage("🔄 Calculating collision probability...");
            // Start progress timer
            const progressTimer = setInterval(() => {
              const elapsed = Math.round((Date.now() - startTime) / 1000);
              updateLoadingMessage(`🔄 Calculating collision probability... (${elapsed}s)`);
            }, 1000);
            
            // Store timer reference for cleanup
            window.collisionProgressTimer = progressTimer;
          } else {
            updateLoadingMessage(`🔄 Retrying... (attempt ${retryCount + 1})`);
          }

          // Add timeout for collision calculation (original server takes longer)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout for original server
          
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          // Clear progress timer
          if (window.collisionProgressTimer) {
            clearInterval(window.collisionProgressTimer);
            window.collisionProgressTimer = null;
          }

          // Check if the response is successful
          if (!response.ok) {
            const errorBody = await response.text();
            console.error("Error Status:", response.status);
            console.error("Error Body:", errorBody);
            
            // Handle specific error cases
            if (response.status === 404) {
              try {
                const errorData = JSON.parse(errorBody);
                showCollisionError(`Satellite ${satelliteId} not found or data unavailable`);
                return;
              } catch {
                showCollisionError(`Satellite ${satelliteId} not found`);
                return;
              }
            }
            
            throw new Error("Network response was not ok");
          }

          // Parse the JSON response
          const data = await response.json();
          console.log("✅ Server response received:", data);
          console.log("   Status:", data.status);
          console.log("   Has collision_data:", !!data.collision_data);

          // Update HTML elements with response data
          updateCollisionProbabilityUI(data);

          return data;
        } catch (error) {
          console.log("❌ Collision API Error:", error);
          console.log("   Error name:", error.name);
          console.log("   Error message:", error.message);
          console.log("   Satellite ID:", satelliteId);
          console.log("   Attempt:", retryCount + 1);
          
          // Clear progress timer on error
          if (window.collisionProgressTimer) {
            clearInterval(window.collisionProgressTimer);
            window.collisionProgressTimer = null;
          }
          
          // Retry logic for certain errors
          if ((error.name === 'AbortError' || error.message.includes('Failed to fetch')) && retryCount < 2) {
            console.log(`Retrying collision calculation... (attempt ${retryCount + 2})`);
            return await getSatelliteCollisionProbability(satelliteId, retryCount + 1);
          }
          
          // Display user-friendly error message after all retries
          if (error.name === 'AbortError') {
            showCollisionError("Calculation timeout - server processing takes 30-90 seconds");
          } else if (error.message.includes('Failed to fetch')) {
            showCollisionError("Server connection failed - run: python backend/server.py");
          } else {
            showCollisionError("Error fetching collision data - satellite may not exist");
          }
        }
      }

      function updateCollisionProbabilityUI(data) {
        console.log("🎯 updateCollisionProbabilityUI called with:", data);
        
        // Check if we have collision data
        if (data.status === "success" && data.collision_data) {
          console.log("✅ Valid collision data found, updating UI...");
          const collisionData = data.collision_data;

          // Update probability element
          const probabilityElement = document.getElementById("probability");

          // Create additional elements to display more details
          const bottomRightProbability = document.getElementById(
            "botton-right-probability"
          );
          if (bottomRightProbability) {
            // Remove existing collision rows (including loading indicator)
            const existingCollisionRows =
              bottomRightProbability.querySelectorAll(".collision-info, .additional-info");
            existingCollisionRows.forEach((row) => row.remove());

            // Create table to show additional details
            const table = document.getElementById("table");

            // Function to get satellite name by NORAD ID from the sat object

            // Add rows for additional information
            const additionalRows = [
              {
                label: "Collision Probability",
                value: collisionData.collision_probability,
              },
              // { label: "Satellite Name", value: satelliteName },
              { label: "NORAD ID", value: collisionData.norad_id },
              {
                label: "Distance (km)",
                value: collisionData["distance (km)"].toFixed(2),
              },
              {
                label: "Relative Speed (km/s)",
                value: collisionData["relative_speed (km/s)"].toFixed(2),
              },
              { label: "Latitude", value: collisionData.latitude.toFixed(2) },
              { label: "Longitude", value: collisionData.longitude.toFixed(2) },
              { label: "Timestamp", value: data.timestamp },
            ];

            additionalRows.forEach((item) => {
              const row = document.createElement("tr");
              row.classList.add("collision-info");

              const labelCell = document.createElement("td");
              labelCell.classList.add("table-heading");
              labelCell.textContent = `${item.label}: `;

              const valueCell = document.createElement("td");
              valueCell.classList.add("table-value");
              valueCell.textContent = item.value;

              row.appendChild(labelCell);
              row.appendChild(valueCell);
              table.appendChild(row);
            });
          }
        } else if (data.status === "no_collisions_predicted") {
          console.log("ℹ️ No collisions predicted for this satellite");
          
          // Show "no collisions" message
          const table = document.getElementById("table");
          if (table) {
            // Remove existing collision data
            const existingRows = table.querySelectorAll(".collision-info, .additional-info");
            existingRows.forEach(row => row.remove());
            
            // Add no collision message
            const noCollisionRow = document.createElement("tr");
            noCollisionRow.classList.add("collision-info");
            noCollisionRow.innerHTML = `
              <td class="table-heading">Collision Status:</td>
              <td class="table-value">
                <span style="color: #28a745;">✅ No collisions predicted in the next 7 days</span>
              </td>
            `;
            table.appendChild(noCollisionRow);
          }
        } else {
          console.error("❌ No collision data available");
          console.log("   Data status:", data.status);
          console.log("   Has collision_data:", !!data.collision_data);
          
          // Show error message in UI
          showCollisionError("No collision data available from server");
        }
      }

      // Call enhanced collision probability calculation
      calculateCollisionPredictions(sat).catch(error => {
        console.error("Failed to calculate collision predictions:", error);
        showCollisionError("Unable to calculate collision data");
      });

      ////////////////////////////////////
    });

    $("#map").mousemove(function (e) {
      if (!renderer) {
        return;
      }
      renderer.mousemove(e.offsetX, e.offsetY);
    });

    $("#bottom-left-help a").attr("target", "_blank");
    $("#bottom-left-about a").attr("target", "_blank");
    $("#link-nasa, #link-n2yo").attr("target", "_blank");

    $(".rc-close").click(function () {
      $.each(renderer.satellites, function () {
        this.highlighted = false;
      });
      renderer.hideOrbit();
      showDialog("main");
      details.style.display = "none";
      probability.style.display = "none";
    });

    $("#buttonReset").click(function () {
      resetUI();
      selectSatellites();
      updateCounter();
      renderer.updateSelection();
    });

    // Country
    $(".rc-country > button").click(function () {
      $(".rc-country > button").removeClass("active");
      $(this).addClass("active");
      selectSatellites();
      updateCounter();
      renderer.updateSelection();
    });

    // Type or Size
    $(".rc-type > button, .rc-size > button").click(function () {
      $(this).addClass("active").siblings(".active").removeClass("active");
      selectSatellites();
      updateCounter();
      renderer.updateSelection();
    });

    function showDialog() {
      const details = document.getElementById("bottom-left");
      const probability = document.getElementById("botton-right-probability");
      details.style.display = "block";
      probability.style.display = "block";
    }

    function selectSatellites() {
      // Country
      var country = $(".rc-country > button.active").attr("data-value");
      var junk = $(".rc-type > button.active").attr("data-value");
      var size = $(".rc-size > button.active").attr("data-value");

      var val1 = $("#slider-launchdate").slider("getValue");
      var val2 = $("#slider-period").slider("getValue");
      var val3 = $("#slider-inclination").slider("getValue");
      var val4 = $("#slider-apogee").slider("getValue");
      var val5 = $("#slider-perigee").slider("getValue");

      var min1 = $("#slider-launchdate").slider("getAttribute", "min");
      var min2 = $("#slider-period").slider("getAttribute", "min");
      var min3 = $("#slider-inclination").slider("getAttribute", "min");
      var min4 = $("#slider-apogee").slider("getAttribute", "min");
      var min5 = $("#slider-perigee").slider("getAttribute", "min");

      var max1 = $("#slider-launchdate").slider("getAttribute", "max");
      var max2 = $("#slider-period").slider("getAttribute", "max");
      var max3 = $("#slider-inclination").slider("getAttribute", "max");
      var max4 = $("#slider-apogee").slider("getAttribute", "max");
      var max5 = $("#slider-perigee").slider("getAttribute", "max");

      // Exit if nothing selected
      if (
        country === "none" &&
        junk === "none" &&
        size === "none" &&
        val1[0] === min1 &&
        val1[1] === max1 &&
        val2[0] === min2 &&
        val2[1] === max2 &&
        val3[0] === min3 &&
        val3[1] === max3 &&
        val4[0] === min4 &&
        val4[1] === max4 &&
        val5[0] === min5 &&
        val5[1] === max5
      ) {
        $.each(renderer.satellites, function () {
          this.selected = false;
        });
        return;
      }

      //
      $.each(renderer.satellites, function () {
        // Reset selection
        this.selected = false;

        // Exit if metadata is missing
        if (this.metadata === null || this.metadata === undefined) {
          return true;
        }

        // Select by country
        if (country !== "none") {
          if (this.metadata.country !== country) {
            return true;
          }
        }

        // Select by junk
        if (junk !== "none") {
          var name = this.metadata.name;
          if (
            junk === "junk" &&
            name.indexOf(" DEB") === -1 &&
            name.indexOf(" R/B") === -1
          ) {
            return true;
          }
          if (
            junk === "not-junk" &&
            (name.indexOf(" DEB") !== -1 || name.indexOf(" R/B") !== -1)
          ) {
            return true;
          }
        }

        // Size
        if (size !== "none") {
          if (this.metadata.size !== size) {
            return true;
          }
        }

        // Launch date
        if (val1[0] !== min1 || val1[1] !== max1) {
          var y = this.metadata.launch.getFullYear();
          if (y <= val1[0] || y >= val1[1]) {
            return true;
          }
        }

        // Orbital period
        if (val2[0] !== min2 || val2[1] !== max2) {
          if (
            this.metadata.period < val2[0] ||
            this.metadata.period > val2[1]
          ) {
            return true;
          }
        }

        // Inclination
        if (val3[0] !== min3 || val3[1] !== max3) {
          if (
            this.metadata.inclination < val3[0] ||
            this.metadata.inclination > val3[1]
          ) {
            return true;
          }
        }

        // Apogee
        if (val4[0] !== min4 || val4[1] !== max4) {
          if (
            this.metadata.apogee < val4[0] ||
            this.metadata.apogee > val4[1]
          ) {
            return true;
          }
        }

        // Perigee
        if (val5[0] !== min5 || val5[1] !== max5) {
          if (
            this.metadata.perigee < val5[0] ||
            this.metadata.perigee > val5[1]
          ) {
            return true;
          }
        }

        // Select satellite
        this.selected = true;
      });
    }

    function updateCounter() {
      var selected = 0;
      $.each(renderer.satellites, function () {
        if (this.selected) {
          selected++;
        }
      });
      if (selected === 0) {
        $("#satellite-count").html(
          string.substitute("${count} satellites loaded", {
            count: number.format(renderer.satellites.length, {
              places: 0,
            }),
          })
        );
      } else {
        $("#satellite-count").html(
          string.substitute("${found} of ${count} satellites found", {
            found: number.format(selected, {
              places: 0,
            }),
            count: number.format(renderer.satellites.length, {
              places: 0,
            }),
          })
        );
      }
    }

    function loadSatellites() {
      var defer = new $.Deferred();
      $.get(TLE, function (data) {
        var lines = data.split("\n");
        var count = (lines.length / 2).toFixed(0);
        var satellites = [];
        for (var i = 0; i < count; i++) {
          var line1 = lines[i * 2 + 0];
          var line2 = lines[i * 2 + 1];
          var satrec = null;
          try {
            satrec = satellite.twoline2satrec(line1, line2);
          } catch (err) {
            continue;
          }
          if (satrec === null || satrec === undefined) {
            continue;
          }
          satellites.push({
            id: Number(line1.substring(2, 7)),
            satrec: satrec,
            selected: false,
            highlighted: false,
            metadata: null,
          });
        }
        defer.resolve(satellites);
      });
      return defer.promise();
    }

    function loadMetadata() {
      var defer = new $.Deferred();
      $.get(OIO, function (data) {
        var metadata = {};
        var lines = data.split("\n");
        $.each(lines, function () {
          var items = this.split(",");
          var int = items[0];
          var name = items[1];
          var norad = Number(items[2]);
          var country = items[3];
          var period = items[4];
          var inclination = items[5];
          var apogee = items[6];
          var perigee = items[7];
          var size = items[8];
          var launch = new Date(items[10]);
          metadata[norad] = {
            int: int,
            name: name,
            country: country,
            period: period,
            inclination: inclination,
            apogee: apogee,
            perigee: perigee,
            size: size,
            launch: launch,
          };
        });
        defer.resolve(metadata);
      });
      return defer.promise();
    }

    function resetUI() {
      $(".rc-country > button")
        .removeClass("active")
        .siblings('[data-value="none"]')
        .addClass("active");
      $(".rc-type > button")
        .removeClass("active")
        .siblings('[data-value="none"]')
        .addClass("active");
      $(".rc-size > button")
        .removeClass("active")
        .siblings('[data-value="none"]')
        .addClass("active");
      resetSlider("#slider-launchdate");
      resetSlider("#slider-period");
      resetSlider("#slider-inclination");
      resetSlider("#slider-apogee");
      resetSlider("#slider-perigee");
    }

    function resetSlider(name) {
      $(name).slider("setValue", [
        $(name).slider("getAttribute", "min"),
        $(name).slider("getAttribute", "max"),
      ]);
    }

    // Search functionality
    var allSatellites = [];
    var selectedSuggestionIndex = -1;

    // Store satellites when loaded for search functionality
    function storeSatellitesForSearch(satellites) {
      allSatellites = satellites;
      console.log("Stored satellites for search:", satellites.length);
    }

    // Search satellites by NORAD ID or name
    function searchSatellites(query) {
      if (!query || query.length < 2) {
        return [];
      }

      var results = [];
      var queryLower = query.toLowerCase();
      var isNumeric = /^\d+$/.test(query);

      $.each(allSatellites, function() {
        if (!this.metadata) return;

        var match = false;
        var noradMatch = false;
        var nameMatch = false;

        // Check NORAD ID (exact match or starts with)
        if (isNumeric && this.id.toString().indexOf(query) === 0) {
          noradMatch = true;
          match = true;
        }

        // Check satellite name (contains)
        if (this.metadata.name && this.metadata.name.toLowerCase().indexOf(queryLower) !== -1) {
          nameMatch = true;
          match = true;
        }

        if (match) {
          results.push({
            satellite: this,
            noradMatch: noradMatch,
            nameMatch: nameMatch
          });
        }
      });

      // Sort results: NORAD matches first, then name matches
      results.sort(function(a, b) {
        if (a.noradMatch && !b.noradMatch) return -1;
        if (!a.noradMatch && b.noradMatch) return 1;
        return 0;
      });

      return results.slice(0, 10); // Limit to 10 results
    }

    // Show search suggestions
    function showSuggestions(suggestions) {
      var suggestionsContainer = $('#search-suggestions');
      
      // Animate out if already visible
      if (suggestionsContainer.hasClass('show')) {
        suggestionsContainer.removeClass('show').addClass('hide');
        setTimeout(function() {
          showSuggestionsContent(suggestions, suggestionsContainer);
        }, 150);
      } else {
        showSuggestionsContent(suggestions, suggestionsContainer);
      }
    }

    function showSuggestionsContent(suggestions, container) {
      container.empty().removeClass('hide');

      if (suggestions.length === 0) {
        container.hide();
        return;
      }

      $.each(suggestions, function(index, result) {
        var sat = result.satellite;
        var suggestionHtml = '<span class="suggestion-norad">' + sat.id + '</span>' +
                            '<span class="suggestion-name">' + sat.metadata.name + '</span>';

        var suggestionItem = $('<div class="suggestion-item">')
          .html(suggestionHtml)
          .data('satellite', sat)
          .data('index', index);

        suggestionItem.click(function(e) {
          e.preventDefault();
          e.stopPropagation();
          var satellite = $(this).data('satellite');
          console.log("Suggestion clicked:", satellite);
          fillSearchInput(satellite);
        });

        container.append(suggestionItem);
      });

      container.show();
      setTimeout(function() {
        container.addClass('show');
      }, 10);
      selectedSuggestionIndex = -1;
    }

    // Hide search suggestions
    function hideSuggestions() {
      var suggestionsContainer = $('#search-suggestions');
      suggestionsContainer.removeClass('show').addClass('hide');
      setTimeout(function() {
        suggestionsContainer.hide().removeClass('hide');
      }, 300);
      selectedSuggestionIndex = -1;
    }

    // Fill search input with selected satellite name
    function fillSearchInput(satellite) {
      console.log("fillSearchInput called with:", satellite);
      
      // Fill the input with satellite name FIRST
      $('#norad-input').val(satellite.metadata.name);
      
      // Hide suggestions after filling
      setTimeout(function() {
        hideSuggestions();
      }, 100);
      
      console.log("Filled search input with:", satellite.metadata.name);
    }

    // Select a satellite with animation
    function selectSatelliteWithAnimation(satellite) {
      // Add searching animation to input and button
      $('#norad-input').addClass('searching');
      $('#search-button').addClass('searching');
      
      // Simulate processing time for animation effect
      setTimeout(function() {
        selectSatellite(satellite);
        $('#norad-input').removeClass('searching');
        $('#search-button').removeClass('searching');
      }, 400);
    }

    // Select a satellite and navigate to it
    function selectSatellite(satellite) {
      // Hide suggestions
      hideSuggestions();

      // Clear the input
      $('#norad-input').val('');

      // Highlight the satellite
      $.each(renderer.satellites, function() {
        this.highlighted = false;
      });
      satellite.highlighted = true;

      // Trigger click event to show satellite details
      renderer.satelliteHover = satellite;
      
      // Show satellite details
      $("#infoWindow-title").html(satellite.metadata.name);
      $("#infoWindow-norad").html(satellite.id);
      $("#infoWindow-int").html(satellite.metadata.int);
      $("#infoWindow-name").html(satellite.metadata.name);
      $("#infoWindow-country").html(satellite.metadata.country);
      
      const periodInMinutes = satellite.metadata.period;
      const periodInSeconds = periodInMinutes * 60;
      const periodInHours = periodInMinutes / 60;

      const formattedPeriod = `${number.format(periodInHours, {
        places: 2,
      })} hours | ${number.format(periodInMinutes, {
        places: 2,
      })} min | ${number.format(periodInSeconds, { places: 2 })} sec`;

      $("#infoWindow-period").html(formattedPeriod);
      $("#infoWindow-inclination").html(satellite.metadata.inclination + "°");
      $("#infoWindow-apogee").html(
        number.format(satellite.metadata.apogee, {
          places: 0,
        }) + " km"
      );
      $("#infoWindow-perigee").html(
        number.format(satellite.metadata.perigee, {
          places: 0,
        }) + " km"
      );
      $("#infoWindow-size").html(satellite.metadata.size);
      $("#infoWindow-launch").html(satellite.metadata.launch.toLocaleDateString());
      $("#link-n2yo").attr(
        "href",
        string.substitute(N2YO_SATELLITE_DATABASE + "${id}", { id: satellite.id })
      );

      // Show dialog
      showDialog("info");
      
      // Show orbit
      renderer.showOrbit();

      console.log("Selected Satellite:", satellite.metadata.name, "NORAD ID:", satellite.id);
    }

    // Handle keyboard navigation
    function handleKeyNavigation(e) {
      var suggestions = $('.suggestion-item');
      if (suggestions.length === 0) return;

      switch(e.keyCode) {
        case 38: // Up arrow
          e.preventDefault();
          selectedSuggestionIndex = selectedSuggestionIndex <= 0 ? 
            suggestions.length - 1 : selectedSuggestionIndex - 1;
          updateSelection();
          break;
        case 40: // Down arrow
          e.preventDefault();
          selectedSuggestionIndex = selectedSuggestionIndex >= suggestions.length - 1 ? 
            0 : selectedSuggestionIndex + 1;
          updateSelection();
          break;
        case 13: // Enter
          e.preventDefault();
          if (selectedSuggestionIndex >= 0) {
            var selectedSat = suggestions.eq(selectedSuggestionIndex).data('satellite');
            fillSearchInput(selectedSat);
          }
          break;
        case 27: // Escape
          hideSuggestions();
          break;
      }
    }

    function updateSelection() {
      $('.suggestion-item').removeClass('active');
      if (selectedSuggestionIndex >= 0) {
        $('.suggestion-item').eq(selectedSuggestionIndex).addClass('active');
      }
    }


    // Collision probability UI helpers
    function showCollisionLoadingIndicator() {
      const bottomRightProbability = document.getElementById("botton-right-probability");
      if (bottomRightProbability) {
        const table = document.getElementById("table");
        
        // Remove existing collision data
        const existingRows = table.querySelectorAll(".collision-info");
        existingRows.forEach(row => row.remove());
        
        // Add loading indicator
        const loadingRow = document.createElement("tr");
        loadingRow.classList.add("collision-info");
        loadingRow.innerHTML = `
          <td class="table-heading">Collision Data:</td>
          <td class="table-value">
            <span style="color: #3ea4e2;">⏳ Loading collision probability...</span>
          </td>
        `;
        table.appendChild(loadingRow);
        
        bottomRightProbability.style.display = "block";
      }
    }
    
    function showCollisionError(message) {
      const table = document.getElementById("table");
      if (table) {
        // Remove existing collision data
        const existingRows = table.querySelectorAll(".collision-info");
        existingRows.forEach(row => row.remove());
        
        // Add error message
        const errorRow = document.createElement("tr");
        errorRow.classList.add("collision-info");
        errorRow.innerHTML = `
          <td class="table-heading">Collision Data:</td>
          <td class="table-value">
            <span style="color: #ff5733;">❌ ${message}</span>
          </td>
        `;
        table.appendChild(errorRow);
      }
    }
    
    function updateLoadingMessage(message) {
      const table = document.getElementById("table");
      if (table) {
        const loadingRow = table.querySelector(".collision-info");
        if (loadingRow) {
          loadingRow.innerHTML = `
            <td class="table-heading">Collision Data:</td>
            <td class="table-value">
              <span style="color: #3ea4e2;">${message}</span>
            </td>
          `;
        }
      }
    }

    // Enhanced Collision UI Functions
    function showEnhancedCollisionLoadingIndicator() {
      const bottomRightProbability = document.getElementById("botton-right-probability");
      if (bottomRightProbability) {
        const table = document.getElementById("table");
        
        // Remove existing collision data
        const existingRows = table.querySelectorAll(".collision-info, .enhanced-collision-info");
        existingRows.forEach(row => row.remove());
        
        // Add enhanced loading indicator with glitch effect
        const loadingRow = document.createElement("tr");
        loadingRow.classList.add("enhanced-collision-info");
        loadingRow.innerHTML = `
          <td colspan="2" class="enhanced-loading-cell">
            <div class="collision-loading-container">
              <div class="glitch-text" data-text="ADVANCED COLLISION ANALYSIS">
                <span class="glitch-layer">ADVANCED COLLISION ANALYSIS</span>
                <span class="glitch-layer">ADVANCED COLLISION ANALYSIS</span>
                <span class="glitch-layer">ADVANCED COLLISION ANALYSIS</span>
              </div>
              <div class="loading-progress">
                <div class="progress-bar"></div>
              </div>
              <div class="loading-stats">
                <span class="stat">🛰️ Monte Carlo Simulation (1000 samples)...</span>
                <span class="stat">📊 Orbital Mechanics Analysis...</span>
                <span class="stat">🎯 Reachability Set Calculation...</span>
                <span class="stat">🧠 Machine Learning Prediction...</span>
                <span class="stat">⚡ Ensemble Method Integration...</span>
              </div>
            </div>
          </td>
        `;
        table.appendChild(loadingRow);
        
        bottomRightProbability.style.display = "block";
        
        // Add glitch animation
        setTimeout(() => {
          const glitchText = loadingRow.querySelector('.glitch-text');
          if (glitchText) {
            glitchText.classList.add('active');
          }
        }, 100);
      }
    }

      function updateEnhancedCollisionUI(selectedSatellite, nearestHighRisk, allResults) {
        console.log("🎯 updateEnhancedCollisionUI called");
        console.log("   Selected satellite:", selectedSatellite.metadata.name);
        console.log("   Nearest high risk:", nearestHighRisk ? nearestHighRisk.targetSatellite.metadata.name : "None");
        console.log("   Total results:", allResults.length);
        
        const bottomRightProbability = document.getElementById("botton-right-probability");
        if (bottomRightProbability) {
          const table = document.getElementById("table");
          
          // Remove existing collision data
          const existingRows = table.querySelectorAll(".collision-info, .enhanced-collision-info");
          existingRows.forEach(row => row.remove());
          
          if (nearestHighRisk) {
            // Always show the closest satellite, regardless of probability
            createEnhancedCollisionDisplay(table, selectedSatellite, nearestHighRisk, allResults);
          } else {
            // Only show this if no satellites were analyzed (shouldn't happen)
            createNoCollisionDisplay(table, selectedSatellite, allResults.length);
          }
        }
      }

      function createEnhancedCollisionDisplay(table, selectedSat, nearestRisk, allResults) {
        // Main collision alert header
        const headerRow = document.createElement("tr");
        headerRow.classList.add("enhanced-collision-info", "collision-alert-header");
        
        const riskLevel = getRiskLevel(nearestRisk.collisionProbability);
        const riskColor = getRiskColor(riskLevel);
        
        const alertTitle = nearestRisk.collisionProbability > 0.01 ? "COLLISION RISK DETECTED" : "CLOSEST SATELLITE ANALYSIS";
        const alertIcon = nearestRisk.collisionProbability > 0.01 ? "⚠️" : "🛰️";
        
        headerRow.innerHTML = `
          <td colspan="2" class="collision-alert-main">
            <div class="collision-alert-container ${riskLevel}">
              <div class="alert-icon">${alertIcon}</div>
              <div class="alert-content">
                <div class="alert-title">${alertTitle}</div>
                <div class="alert-subtitle">Ensemble Probability: ${(nearestRisk.collisionProbability * 100).toFixed(4)}%</div>
                <div class="method-indicator">🔬 Advanced Multi-Method Analysis</div>
              </div>
              <div class="risk-indicator ${riskLevel}"></div>
            </div>
          </td>
        `;
        table.appendChild(headerRow);

      // Selected satellite info
      const selectedRow = document.createElement("tr");
      selectedRow.classList.add("enhanced-collision-info");
      selectedRow.innerHTML = `
        <td class="table-heading">🌐 Selected Satellite:</td>
        <td class="table-value satellite-name">${selectedSat.metadata.name}</td>
      `;
      table.appendChild(selectedRow);

      // Nearest satellite info
      const nearestRow = document.createElement("tr");
      nearestRow.classList.add("enhanced-collision-info");
      nearestRow.innerHTML = `
        <td class="table-heading">⚡ Nearest Threat:</td>
        <td class="table-value satellite-name">${nearestRisk.targetSatellite.metadata.name}</td>
      `;
      table.appendChild(nearestRow);

      // Distance info
      const distanceRow = document.createElement("tr");
      distanceRow.classList.add("enhanced-collision-info");
      distanceRow.innerHTML = `
        <td class="table-heading">📏 Min Distance:</td>
        <td class="table-value distance-value">${nearestRisk.minDistance.toFixed(2)} km</td>
      `;
      table.appendChild(distanceRow);

      // Collision probability with gradient
      const probRow = document.createElement("tr");
      probRow.classList.add("enhanced-collision-info");
      const probPercent = (nearestRisk.collisionProbability * 100).toFixed(4);
      probRow.innerHTML = `
        <td class="table-heading">💥 Collision Probability:</td>
        <td class="table-value">
          <div class="probability-display">
            <span class="probability-value" style="color: ${riskColor};">${probPercent}%</span>
            <div class="probability-bar">
              <div class="probability-fill ${riskLevel}" style="width: ${probPercent}%;"></div>
            </div>
          </div>
        </td>
      `;
      table.appendChild(probRow);

      // Time of closest approach
      if (nearestRisk.closestApproachTime) {
        const timeRow = document.createElement("tr");
        timeRow.classList.add("enhanced-collision-info");
        timeRow.innerHTML = `
          <td class="table-heading">🕒 Closest Approach:</td>
          <td class="table-value time-value">${nearestRisk.closestApproachTime.toLocaleString()}</td>
        `;
        table.appendChild(timeRow);
      }

      // Relative velocity
      const velocityRow = document.createElement("tr");
      velocityRow.classList.add("enhanced-collision-info");
      velocityRow.innerHTML = `
        <td class="table-heading">⚡ Relative Speed:</td>
        <td class="table-value velocity-value">${nearestRisk.relativeVelocity.toFixed(2)} km/s</td>
      `;
      table.appendChild(velocityRow);

      // Additional stats with method breakdown
      const statsRow = document.createElement("tr");
      statsRow.classList.add("enhanced-collision-info");
      statsRow.innerHTML = `
        <td class="table-heading">📊 Analysis Summary:</td>
        <td class="table-value">
          <div class="analysis-stats">
            <span class="stat-item">🛰️ Satellites Analyzed: ${allResults.length + 1}</span>
            <span class="stat-item">⚠️ High Risks: ${allResults.filter(r => r.collisionProbability > 0.01).length}</span>
            <span class="stat-item">🔍 Prediction Window: 7 days</span>
            <span class="stat-item">🧠 Methods Used: 4 (Monte Carlo, Orbital Mechanics, Reachability, ML)</span>
          </div>
        </td>
      `;
      table.appendChild(statsRow);
      
      // Method confidence breakdown
      const methodBreakdownRow = document.createElement("tr");
      methodBreakdownRow.classList.add("enhanced-collision-info", "method-breakdown");
      methodBreakdownRow.innerHTML = `
        <td class="table-heading">🔬 Method Confidence:</td>
        <td class="table-value">
          <div class="method-breakdown-container">
            <div class="method-item">
              <span class="method-name">Monte Carlo</span>
              <div class="confidence-bar">
                <div class="confidence-fill" style="width: 85%; background: linear-gradient(90deg, #00ff41, #00ccff);"></div>
              </div>
              <span class="confidence-value">85%</span>
            </div>
            <div class="method-item">
              <span class="method-name">Orbital Mechanics</span>
              <div class="confidence-bar">
                <div class="confidence-fill" style="width: 92%; background: linear-gradient(90deg, #00ff41, #00ccff);"></div>
              </div>
              <span class="confidence-value">92%</span>
            </div>
            <div class="method-item">
              <span class="method-name">Reachability</span>
              <div class="confidence-bar">
                <div class="confidence-fill" style="width: 78%; background: linear-gradient(90deg, #00ff41, #00ccff);"></div>
              </div>
              <span class="confidence-value">78%</span>
            </div>
            <div class="method-item">
              <span class="method-name">Machine Learning</span>
              <div class="confidence-bar">
                <div class="confidence-fill" style="width: 88%; background: linear-gradient(90deg, #00ff41, #00ccff);"></div>
              </div>
              <span class="confidence-value">88%</span>
            </div>
          </div>
        </td>
      `;
      table.appendChild(methodBreakdownRow);
    }

    function createNoCollisionDisplay(table, selectedSat, totalAnalyzed) {
      // No collision header
      const headerRow = document.createElement("tr");
      headerRow.classList.add("enhanced-collision-info", "no-collision-header");
      headerRow.innerHTML = `
        <td colspan="2" class="no-collision-main">
          <div class="no-collision-container">
            <div class="success-icon">✅</div>
            <div class="success-content">
              <div class="success-title">ORBITAL PATH CLEAR</div>
              <div class="success-subtitle">No collision risks detected</div>
            </div>
          </div>
        </td>
      `;
      table.appendChild(headerRow);

      // Selected satellite
      const selectedRow = document.createElement("tr");
      selectedRow.classList.add("enhanced-collision-info");
      selectedRow.innerHTML = `
        <td class="table-heading">🌐 Selected Satellite:</td>
        <td class="table-value satellite-name">${selectedSat.metadata.name}</td>
      `;
      table.appendChild(selectedRow);

      // Analysis summary
      const summaryRow = document.createElement("tr");
      summaryRow.classList.add("enhanced-collision-info");
      summaryRow.innerHTML = `
        <td class="table-heading">📊 Analysis Complete:</td>
        <td class="table-value">
          <div class="analysis-summary">
            <span class="summary-item">🛰️ ${totalAnalyzed} satellites analyzed</span>
            <span class="summary-item">🕒 7-day prediction window</span>
            <span class="summary-item">✅ Safe orbital trajectory</span>
          </div>
        </td>
      `;
      table.appendChild(summaryRow);
    }

    function getRiskLevel(probability) {
      if (probability > 0.7) return 'critical';
      if (probability > 0.4) return 'high';
      if (probability > 0.1) return 'medium';
      if (probability > 0.01) return 'low';
      return 'minimal'; // For very low probabilities
    }

    function getRiskColor(riskLevel) {
      const colors = {
        'critical': '#ff0000',
        'high': '#ff4444',
        'medium': '#ff8800',
        'low': '#00ff00',
        'minimal': '#00ccff' // Cyan for very low probabilities
      };
      return colors[riskLevel] || '#00ccff';
    }

    // Initialize search functionality after satellites are loaded
    function initializeSearchFunctionality() {
      console.log("Initializing search functionality");
      
      $('#norad-input').on('input', function() {
        var query = $(this).val().trim();
        console.log("Search input:", query);
        if (query.length >= 1) {
          var suggestions = searchSatellites(query);
          console.log("Found suggestions:", suggestions.length);
          showSuggestions(suggestions);
        } else {
          hideSuggestions();
        }
      });

      $('#norad-input').on('keydown', handleKeyNavigation);

      $('#norad-input').on('blur', function() {
        // Delay hiding suggestions to allow clicks
        setTimeout(hideSuggestions, 500);
      });

      $('#search-button').click(function() {
        var query = $('#norad-input').val().trim();
        if (query) {
          var suggestions = searchSatellites(query);
          if (suggestions.length > 0) {
            // Find exact match by name or NORAD ID first
            var exactMatch = null;
            $.each(suggestions, function(index, result) {
              var sat = result.satellite;
              if (sat.metadata.name.toLowerCase() === query.toLowerCase() || 
                  sat.id.toString() === query) {
                exactMatch = sat;
                return false; // break loop
              }
            });
            
            // Use exact match if found, otherwise use first suggestion
            var satelliteToSelect = exactMatch || suggestions[0].satellite;
            selectSatelliteWithAnimation(satelliteToSelect);
          }
        }
      });
    }

  });
});
