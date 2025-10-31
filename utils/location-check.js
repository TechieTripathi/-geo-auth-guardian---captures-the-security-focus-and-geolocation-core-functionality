// utils/location-check.js

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Returns an object { distanceKm, timeHours, requiredKmh, suspicious: bool, reason: string }
 * t1 and t2 are JS timestamps (ms)
 * accA and accB are in meters
 */
function evaluateLoginPair(latA, lonA, accA, t1ms, latB, lonB, accB, t2ms, options = {}) {
  const maxSpeedKmh = options.maxSpeedKmh ?? 900; // tune this (900 km/h ~ commercial jet)
  const distanceKm = haversineKm(latA, lonA, latB, lonB);
  const timeHours = Math.abs(t2ms - t1ms) / (1000 * 60 * 60);
  const requiredKmh = timeHours === 0 ? Infinity : (distanceKm / timeHours);

  // If accuracy circles overlap -> not suspicious just due to measurement
  const accSumKm = ( (accA ?? 0) + (accB ?? 0) ) / 1000.0;
  if (distanceKm <= accSumKm) {
    return { 
      distanceKm, 
      timeHours, 
      requiredKmh, 
      suspicious: false, 
      reason: "within accuracy radius" 
    };
  }

  // If required speed > maxSpeedKmh => suspicious
  if (requiredKmh > maxSpeedKmh) {
    return {
      distanceKm, 
      timeHours, 
      requiredKmh, 
      suspicious: true,
      reason: `required speed ${requiredKmh.toFixed(0)} km/h exceeds max allowed ${maxSpeedKmh} km/h`
    };
  }

  // Otherwise plausible
  return { 
    distanceKm, 
    timeHours, 
    requiredKmh, 
    suspicious: false, 
    reason: "travel plausible" 
  };
}

module.exports = {
  haversineKm,
  evaluateLoginPair
};