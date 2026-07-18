const riskMeta = {
  0: {
    level: 'Aman',
    label: 'LOW',
    color: 'text-green-600',
    bg: 'bg-green-50',
    icon: 'check_circle'
  },
  1: {
    level: 'Berisiko',
    label: 'MEDIUM',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    icon: 'error'
  },
  2: {
    level: 'Bahaya',
    label: 'HIGH',
    color: 'text-red-600',
    bg: 'bg-red-50',
    icon: 'warning'
  }
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCondition(temp, humidity, ldr) {
  return `suhu ${temp.toFixed(1)}°C, kelembapan ${humidity.toFixed(0)}%, cahaya ${ldr.toFixed(0)}`;
}

function getQualityLabel(score) {
  if (score >= 85) return 'Sangat Baik';
  if (score >= 70) return 'Baik';
  if (score >= 55) return 'Cukup';
  return 'Perlu Dicek';
}

export function calculateSensorQuality({ samples = [], temperature, humidity, ldr } = {}) {
  const sampleList = Array.isArray(samples) ? samples.filter(value => Number.isFinite(Number(value))) : [];
  const sampleCount = sampleList.length;

  // Consensus (how many samples agree)
  let consensusScore = 0;
  if (sampleCount > 0) {
    const counts = {};
    sampleList.forEach(value => {
      const key = String(value);
      counts[key] = (counts[key] || 0) + 1;
    });
    const maxCount = Math.max(...Object.values(counts));
    consensusScore = (maxCount / sampleCount) * 40; // up to 40
  }

  const coverageScore = Math.min(sampleCount / 15, 1) * 30; // up to 30

  const hasDHT = (temperature !== null && temperature !== undefined && humidity !== null && humidity !== undefined && temperature !== '' && humidity !== '');
  const hasLDR = (ldr !== null && ldr !== undefined && ldr !== '');

  // DHT quality - uses consensus + coverage + completeness
  const dhtCompleteness = hasDHT ? 30 : 0; // up to 30
  const dhtScore = Math.round(Math.max(0, Math.min(100, consensusScore * 0.8 + coverageScore * 0.5 + dhtCompleteness)));

  // LDR quality - simpler: presence gives decent base, plus small boost from samples
  const ldrBase = hasLDR ? 50 : 20;
  const ldrScore = Math.round(Math.max(0, Math.min(100, ldrBase + Math.min(sampleCount / 15, 1) * 30)));

  // Combined: weighted average (DHT more important)
  const combined = Math.round((dhtScore * 0.7) + (ldrScore * 0.3));

  return {
    score: combined,
    label: getQualityLabel(combined),
    sampleCount,
    details: {
      dht: { score: dhtScore, label: getQualityLabel(dhtScore), present: !!hasDHT },
      ldr: { score: ldrScore, label: getQualityLabel(ldrScore), present: !!hasLDR }
    }
  };
}

function buildRecommendations({ riskLevel, temperature, humidity, ldr, location, notes = '', sensorQualityDetails = null } = {}) {
  const temp = toNumber(temperature);
  const hum = toNumber(humidity);
  const light = toNumber(ldr);
  const place = (location || 'area ini').trim() || 'area ini';
  const locationText = place.toLowerCase();
  const recommendations = [];
  const immediate = [];
  const shortTerm = [];
  const longTerm = [];
  const checklist = [];
  const contextualTips = [];

  if (/(sudut|pojok|corner)/i.test(locationText)) {
    contextualTips.push('Karena titik ukur berada di sudut atau pojok, udara dapat terperangkap dan angka kelembapan bisa lebih tinggi dari kondisi sebenarnya. Geser alat sedikit menjauh dari dinding untuk memperoleh data lebih representatif.');
  }

  if (/(sampah|trash|bin|tempat sampah)/i.test(locationText)) {
    contextualTips.push('Jika scan dilakukan dekat tempat sampah, area ini cenderung menyimpan kelembapan dan bau organik yang dapat memengaruhi hasil. Pindahkan alat lebih jauh agar pembacaan lebih akurat dan kebersihan terjaga.');
  }

  if (/(lemari|cabinet|laci|closet|rak tertutup)/i.test(locationText)) {
    contextualTips.push('Untuk lemari atau ruang tertutup, sesekali buka pintu dan biarkan udara mengalir agar kelembapan tidak terperangkap dan risiko jamur berkurang.');
  }

  if (/(elektronik|server|pc|komputer|perangkat)/i.test(locationText)) {
    contextualTips.push('Jika berada dekat perangkat elektronik, sumber panas dapat menyebabkan pembacaan suhu lebih tinggi. Jaga jarak dari peralatan untuk mendapatkan data lingkungan yang lebih akurat.');
  }

  if (/(lantai|dekat lantai|bawah)/i.test(locationText)) {
    contextualTips.push('Area dekat lantai seringkali lebih lembap. Jika memungkinkan, pindahkan alat sedikit ke atas untuk mengurangi pengaruh kelembapan lokal.');
  }

  if (riskLevel >= 2) {
    immediate.push('Kondisi ini sudah berisiko tinggi; segera aktifkan kipas, dehumidifier, atau AC untuk mengurangi kelembapan dan meningkatkan sirkulasi udara.');
    immediate.push('Hentikan sementara penyimpanan bahan sensitif seperti kertas, kain, atau benda organik di area ini sampai kondisi membaik.');
    immediate.push('Lap semua permukaan dengan kain kering dan periksa adanya genangan air atau kebocoran tersembunyi di sekitarnya.');

    shortTerm.push(`Lakukan inspeksi menyeluruh di sekitar ${place}: periksa sambungan jendela, pipa bocor, keretakan dinding, atau ventilasi yang tersumbat.`);
    shortTerm.push('Jika ada noda gelap atau bau apek, bersihkan area tersebut dengan pembersih yang sesuai dan pastikan area dikeringkan sempurna.');
    shortTerm.push('Gunakan dehumidifier portabel atau silica gel di area ini untuk menahan kelembapan sampai kondisi terkendali.');

    longTerm.push('Pertimbangkan pemasangan ventilasi mekanis atau exhaust fan untuk mencegah kelembapan tinggi berulang.');
    longTerm.push('Lakukan pemeliharaan rutin pada sistem AC, saluran pembuangan, dan struktur bangunan untuk memastikan tidak ada kelembapan tersisa.');
    longTerm.push('Jika masalah berulang, ajak tenaga profesional untuk evaluasi dan perbaikan struktur atau isolasi ruangan.');
  } else if (riskLevel === 1) {
    immediate.push('Buka jendela atau nyalakan kipas untuk segera memperbaiki sirkulasi udara dan mengurangi kelembapan lokal.');
    immediate.push('Pindahkan alat sedikit menjauh dari dinding, sudut, atau benda besar agar pembacaan tidak bias oleh udara terperangkap.');

    shortTerm.push('Rapikan dan bersihkan area di sekitar alat: hindari penumpukan kain, tumpukan kertas, atau barang lembap yang dapat menjebak udara basah.');
    shortTerm.push('Periksa apakah ada sumber kelembapan seperti pipa bocor, wadah air terbuka, atau kondensasi pada jendela.');
    shortTerm.push('Perkuat penerangan di area ini jika memungkinkan, karena cahaya cukup membantu mengurangi kelembapan dan jamur.');

    longTerm.push('Sediakan jadwal pemeriksaan harian atau mingguan untuk memantau perubahan suhu, kelembapan, dan cahaya.');
    longTerm.push('Pertimbangkan penggunaan penyerapan kelembapan sederhana seperti silica gel, desiccant, atau kantong pengering di sekitar area berisiko.');
  } else {
    immediate.push('Kondisi saat ini relatif aman, tetapi tetap jaga sirkulasi udara dan kebersihan area agar tidak berubah menjadi lembap.');
    shortTerm.push('Lakukan pengecekan ringan setiap beberapa hari untuk memastikan nilai suhu, kelembapan, dan cahaya tetap stabil.');
    shortTerm.push('Pastikan tidak ada penumpukan barang atau bahan organik di sekitar area yang bisa menjebak udara lembap.');
    longTerm.push('Jika area cenderung pengap, pasang ventilasi pasif atau biarkan udara keluar-masuk secara berkala.');
  }

  if (hum >= 85) {
    immediate.unshift('Kelembapan sangat tinggi; hentikan aktivitas yang menambah uap air dan fokus pada pengeringan ruangan.');
    shortTerm.push('Periksa ada tidaknya kondensasi pada dinding atau permukaan dingin sebagai tanda awal kelembapan berlebih.');
  } else if (hum >= 75) {
    immediate.unshift('Kelembapan sudah di zona waspada; utamakan pengeringan dan ventilasi agar kondisi tidak memburuk.');
    shortTerm.push('Gunakan kain kering untuk menyeka area yang terasa lembap atau basah secara berkala.');
  } else if (hum >= 65) {
    shortTerm.unshift('Kelembapan ini cukup untuk mulai mendukung pertumbuhan jamur; jangan biarkan kondisi stagnan.');
  }

  if (temp >= 30) {
    shortTerm.push('Suhu tinggi mempercepat pertumbuhan jamur dan mempercepat kelembapan bergerak, jadi turunkan suhu atau jauhkan alat dari sumber panas.');
  } else if (temp <= 22 && hum >= 70) {
    shortTerm.push('Suhu rendah dengan kelembapan tinggi meningkatkan risiko kondensasi; periksa permukaan dingin seperti jendela, pipa, dan dinding.');
  } else if (temp >= 26 && temp < 30) {
    shortTerm.push('Suhu sedang cenderung nyaman, tetapi tetap waspada jika kelembapan terus tinggi.');
  }

  if (light < 100) {
    shortTerm.push('Cahaya sangat rendah menunjukkan area tertutup dan kurang ventilasi; buka jendela atau pindahkan alat ke tempat yang lebih terang jika bisa.');
  } else if (light < 250) {
    shortTerm.push('Cahaya rendah dapat membuat area terasa lembap dan pengap; tambahkan sumber cahaya alami atau buatan untuk mengurangi risiko.');
  } else {
    longTerm.push('Cahaya sudah memadai, tetapi tetap jaga kebersihan dan sirkulasi udara agar kondisi tidak berubah.');
  }

  if (notes && /jamur|mold|bocor|tumpah|basah|berjamur|berbau/i.test(notes)) {
    recommendations.unshift('Catatan menunjukkan tanda langsung risiko jamur atau kebocoran. Lakukan inspeksi visual secepatnya dan bersihkan area tersebut dengan produk pembersih yang tepat.');
  }

  if (sensorQualityDetails && typeof sensorQualityDetails === 'object') {
    const d = sensorQualityDetails.dht;
    const l = sensorQualityDetails.ldr;

    if (d && !d.present) {
      checklist.push('Periksa koneksi fisik sensor DHT dan pastikan kabel/terminal tidak longgar.');
      checklist.push('Ganti atau kalibrasi sensor DHT jika nilainya tidak konsisten, karena sensor ini memengaruhi validitas kelembapan dan suhu.');
    } else if (d && d.score < 55) {
      checklist.push('Nilai kualitas DHT rendah. Bersihkan sensor dan periksa apakah berada di lokasi yang stabil, tidak terlalu dekat sumber panas atau uap.');
    }

    if (l && !l.present) {
      checklist.push('Periksa sensor cahaya (LDR) apakah terhalang debu, kotoran, atau objek di depannya.');
      checklist.push('Pastikan sensor LDR ditempatkan di sudut yang menerangi area tanpa terlalu banyak bayangan.');
    } else if (l && l.score < 55) {
      checklist.push('Nilai kualitas LDR rendah menunjukkan pembacaan cahaya kurang akurat. Cek posisi sensor dan bersihkan permukaannya.');
    }
  }

  if (immediate.length) recommendations.push('IMMEDIATE: ' + immediate.join(' | '));
  if (shortTerm.length) recommendations.push('SHORT-TERM: ' + shortTerm.join(' | '));
  if (longTerm.length) recommendations.push('LONG-TERM: ' + longTerm.join(' | '));
  if (checklist.length) recommendations.push('CHECKLIST: ' + checklist.join(' | '));
  if (contextualTips.length) recommendations.push(...contextualTips);

  return recommendations;
}

export function getMoldInsights({ riskLevel = 0, temperature = 0, humidity = 0, ldr = 0, location = '', notes = '', sensorQualityDetails = null } = {}) {
  const temp = toNumber(temperature);
  const hum = toNumber(humidity);
  const light = toNumber(ldr);
  const band = riskLevel >= 2 ? 2 : riskLevel === 1 ? 1 : 0;
  const meta = riskMeta[band];

  const summaryByBand = {
    0: `Kondisi ini masih stabil. Dengan suhu ${temp.toFixed(1)}°C dan kelembapan ${hum.toFixed(0)}%, pertumbuhan jamur belum terlalu didorong oleh lingkungan sekitar.`,
    1: `Kondisi mulai mendekati zona lembap. Suhu ${temp.toFixed(1)}°C, kelembapan ${hum.toFixed(0)}%, dan cahaya ${light.toFixed(0)} menunjukkan area perlu diawasi lebih sering.`,
    2: `Kondisi sudah berisiko tinggi. Suhu ${temp.toFixed(1)}°C, kelembapan ${hum.toFixed(0)}%, dan cahaya ${light.toFixed(0)} sangat mendukung pertumbuhan jamur jika tidak segera ditangani.`
  };

  const actionTitleByBand = {
    0: 'Pertahankan kondisi ini',
    1: 'Perbaiki sirkulasi dan turunkan kelembapan',
    2: 'Tindakan cepat diperlukan'
  };

  return {
    riskLevel: band,
    level: meta.level,
    label: meta.label,
    color: meta.color,
    bg: meta.bg,
    icon: meta.icon,
    desc: `${summaryByBand[band]} ${location ? `Konteks lokasi: ${location}.` : ''} ${notes ? `Catatan: ${notes}.` : ''}`.trim(),
    actionTitle: actionTitleByBand[band],
    summary: `Hasil analisis ${location || 'area ini'}: ${formatCondition(temp, hum, light)}.`,
    recommendations: buildRecommendations({ riskLevel: band, temperature: temp, humidity: hum, ldr: light, location, notes, sensorQualityDetails })
  };
}

export function normalizeRecommendations(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\n+/)
      .map(item => item.trim().replace(/^[-•\s]+/, ''))
      .filter(Boolean);
  }

  return fallback;
}

export function buildCombinedAnalysis({ insight, imageName, hasImage } = {}) {
  const safeInsight = insight || { desc: '', actionTitle: '', riskLevel: 0 };
  const imageLabel = imageName || 'foto pendukung';
    const quality = safeInsight.sensorQuality ?? null;
    const details = safeInsight.sensorQualityDetails || safeInsight.sensorQualityDetails || null;

  const sensorQualityStatus = (() => {
    if (details && typeof details === 'object') {
      const dht = details.dht || {};
      const ldr = details.ldr || {};
      return `Kualitas sensor: ${quality !== null ? quality + '%' : '—'} (${quality !== null ? getQualityLabel(quality) : '—'}). Detail — DHT: ${dht.present ? dht.score + '% (' + dht.label + ')' : 'tidak tersedia'}, LDR: ${ldr.present ? ldr.score + '% (' + ldr.label + ')' : 'tidak tersedia'}`;
    }
    if (quality !== null) return `Kualitas sensor: ${quality}% (${getQualityLabel(quality)})`;
    return 'Kualitas sensor belum dihitung';
  })();

  return {
    combinedTitle: 'Analisis gabungan sensor + gambar',
    combinedSummary: hasImage
      ? `${safeInsight.desc} Foto ${imageLabel} sudah dilampirkan sebagai bukti visual tambahan untuk mempermudah validasi kondisi ruangan.`
      : `${safeInsight.desc} Tidak ada foto pendukung, jadi hasil scan ini masih sepenuhnya mengandalkan sensor DHT11 dan LDR.`,
    imageStatus: hasImage
      ? `Foto terunggah: ${imageLabel}`
      : 'Foto belum diunggah',
    sensorQualityStatus,
    sensorQualityDetails: details || null,
  };
}