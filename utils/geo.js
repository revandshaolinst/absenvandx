/**
 * Menghitung jarak antara dua koordinat (Latitude & Longitude) menggunakan rumus Haversine.
 * Hasilnya berupa jarak dalam satuan Meter.
 */
function hitungJarakMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius bumi dalam meter
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // dalam meter

  return distance;
}

module.exports = {
  hitungJarakMeters,
};
