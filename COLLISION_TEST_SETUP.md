# Collision Prediction Test Setup

## 🛰️ **Dummy Satellites Created for Testing**

I've added two dummy satellites specifically designed to test collision prediction with **Pratham (NORAD ID: 41783)**.

### **Target Satellite: PRATHAM**
- **NORAD ID**: 41783
- **Orbital Period**: 98.44 minutes
- **Inclination**: 98.15°
- **Apogee**: 708 km
- **Perigee**: 660 km
- **Size**: SMALL
- **TLE Data**:
  ```
  1 41783U 16059A   17333.14184377  .00000073  00000-0  23588-4 0  9996
  2 41783  98.1471  32.6292 0033642   5.8554 354.3034 14.62882950 62717
  ```

### **Test Satellite 1: COLLISION TEST SAT**
- **NORAD ID**: 99999
- **Purpose**: Moderate collision risk test
- **Orbital Period**: 98.45 minutes (slightly different)
- **Inclination**: 98.15° (same as Pratham)
- **Apogee**: 710 km (+2 km from Pratham)
- **Perigee**: 658 km (-2 km from Pratham)
- **Size**: SMALL
- **TLE Data**:
  ```
  1 99999U 17999A   17333.14184377  .00000075  00000-0  24000-4 0  9998
  2 99999  98.1500  32.6300 0033500   5.8600 354.3100 14.62883000 62720
  ```

### **Test Satellite 2: COLLISION TEST SAT 2**
- **NORAD ID**: 99998
- **Purpose**: High collision risk test
- **Orbital Period**: 98.44 minutes (identical to Pratham)
- **Inclination**: 98.15° (identical to Pratham)
- **Apogee**: 709 km (+1 km from Pratham)
- **Perigee**: 659 km (-1 km from Pratham)
- **Size**: SMALL
- **TLE Data**:
  ```
  1 99998U 17998A   17333.14184377  .00000074  00000-0  23600-4 0  9997
  2 99998  98.1480  32.6280 0033640   5.8540 354.3020 14.62882960 62718
  ```

## 🎯 **Testing Instructions**

### **Step 1: Load the Application**
1. Open `collision.html` in your browser
2. Wait for all satellites to load (should now include 22 satellites total)

### **Step 2: Test Collision Prediction**
1. **Click on Pratham satellite** (NORAD ID: 41783)
2. The collision prediction system should activate
3. Look for the cyberpunk UI overlay showing collision analysis

### **Step 3: Expected Results**
When you click on Pratham, you should see:

```
🛰️ COLLISION RISK DETECTED / CLOSEST SATELLITE ANALYSIS
🌐 Selected Satellite: PRATHAM
⚡ Nearest Threat: COLLISION TEST SAT 2 (or COLLISION TEST SAT)
📏 Min Distance: [Very small value, likely < 50 km]
💥 Collision Probability: [High percentage, likely > 50%]
🕒 Closest Approach: [Timestamp within next few days]
⚡ Relative Speed: [Calculated velocity in km/s]
📊 Analysis Summary: 22 satellites analyzed, X high risks found
```

### **Step 4: Visual Verification**
- **Risk Level Colors**:
  - 🔴 **Critical** (>70%): Red border with intense glow
  - 🟠 **High** (40-70%): Orange border
  - 🟡 **Medium** (10-40%): Yellow border
  - 🟢 **Low** (1-10%): Green border
  - 🔵 **Minimal** (<1%): Cyan border

### **Step 5: Test Other Satellites**
- Click on other satellites to verify they show lower collision risks
- The dummy satellites should consistently appear as the highest threats to Pratham

## 🔧 **Technical Details**

### **Orbital Parameter Differences**
The dummy satellites are designed with:
- **Nearly identical inclinations** (98.15° vs 98.148°/98.15°)
- **Very similar altitudes** (±1-2 km difference)
- **Almost identical orbital periods** (difference of seconds)
- **Slightly offset orbital elements** to create intersection points

### **Expected Collision Scenarios**
1. **COLLISION TEST SAT 2** should show the **highest collision probability** due to:
   - Identical orbital period
   - Minimal altitude difference
   - Very close orbital elements

2. **COLLISION TEST SAT** should show **moderate collision probability** due to:
   - Slightly different orbital period
   - Small altitude differences
   - Similar but not identical orbital elements

## ✅ **Success Criteria**
- ✅ Pratham shows collision warnings when clicked
- ✅ Dummy satellites appear as nearest threats
- ✅ Collision probabilities are calculated and displayed
- ✅ UI shows appropriate risk level colors
- ✅ Distance and velocity calculations work
- ✅ Cyberpunk styling displays correctly

## 🚀 **Ready for Testing!**
The collision prediction system is now ready to test with realistic collision scenarios between Pratham and the specially designed dummy satellites.

