/**
 * Calculate Qibla direction (bearing from location to Kaaba in Mecca)
 * @param latitude - User's latitude
 * @param longitude - User's longitude
 * @returns Bearing in degrees (0-360), where 0 is North
 */
export const calculateQiblaBearing = (latitude: number, longitude: number): number => {
  // Kaaba coordinates in Mecca
  const kaabaLat = 21.4225; // 21.4225° N
  const kaabaLon = 39.8262; // 39.8262° E

  const lat1 = (latitude * Math.PI) / 180;
  const lat2 = (kaabaLat * Math.PI) / 180;
  const deltaLon = ((kaabaLon - longitude) * Math.PI) / 180;

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  let bearing = Math.atan2(y, x);
  bearing = (bearing * 180) / Math.PI;
  bearing = (bearing + 360) % 360;

  return bearing;
};

/**
 * Convert bearing to compass direction
 */
export const getCompassDirection = (bearing: number): string => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
};

