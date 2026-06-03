# Space-Sustainability-Averting-collisions-between-satellites-and-space-debris
 

## 🌍 Project Overview

This project is designed to support **space sustainability** by predicting and preventing potential collisions between active satellites and space debris. It combines satellite tracking, probabilistic modeling, and real-time visualization into a full-stack system.

At its core, the project integrates **Python (Flask)** for the backend, **SGP4** for orbital propagation, and **Gaussian Mixture Models (GMM)** for collision probability estimation. The results are delivered through a responsive web interface built with **HTML, CSS, JavaScript, Bootstrap, Three.js**, and **ArcGIS** for geospatial 3D visualization.

### Core Functionalities:
- 🔍 Search for any satellite by NORAD ID
- 🛰️ View its current orbital details
- 🚨 Predict the highest-risk collision event over the next 7 days

---

## 🎯 Objectives

- Enhance space situational awareness through real-time visualization of orbital assets and debris  
- Predict satellite collisions using accurate physical models and statistical uncertainty  
- Promote sustainable space operations by helping satellite operators avoid potential conjunctions  
- Provide an educational and analytical tool for researchers, space agencies, and students  
- Enable decision support through APIs that deliver predictive collision risk data over time  

---

## 🔬 Methodology

The project follows a modular, data-driven workflow:

### 1. **Data Acquisition**
- Fetch TLE data using authenticated API access from [space-track.org](https://www.space-track.org)
- Maintain a dataset of relevant NORAD IDs for active satellites and known debris
- •	Active satellites  NORAD ID information. [Link](https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle)



### 2. **Orbit Propagation**
- Use the SGP4 model (`python-sgp4`) to convert TLE data into satellite position and velocity in the ECI frame
- Propagate satellite orbits over a 7-day prediction window

### 3. **Collision Prediction Engine**
- Model positional uncertainty using multivariate Gaussian distributions
- Generate Monte Carlo samples of satellite positions
- Apply GMM to evaluate the probability of collision between a target and neighbors
- Identify the highest-risk encounter per satellite

### 4. **API Integration (Flask Backend)**
Flask endpoint: `/satellite-collision-probability`
Returns:
- Predicted closest encounter
- Relative speed and distance
- Collision probability
- Geographic coordinates of risk zone

### 5. **Web Interface (Frontend)**
- Visualize all satellites and debris using **Three.js** and **ArcGIS**
- Filter by object type, country, and size
- Display results dynamically based on NORAD ID search

---

## 🧭 Architecture

![Architecture Diagram](https://github.com/meghamsh1830/Space-Sustainability-Averting-collisions-between-satellites-and-space-debris/blob/main/Architecture%20Diagram.png?raw=true)

---

## 🌐 Collision Prediction Web App

- 🔗 [LYNX Website](http://127.0.0.1:5501/index.html)

- 🔗 [Collision Prediction - by LYNX](http://127.0.0.1:5501/collision.html)

---







