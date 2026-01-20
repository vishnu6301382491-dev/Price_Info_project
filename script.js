// Webcam scanner logic
function setupCameraScanner() {
  const openBtn = document.getElementById('open-camera');
  const cameraSection = document.getElementById('camera-section');
  const video = document.getElementById('camera-video');
  const captureBtn = document.getElementById('capture-btn');
  const canvas = document.getElementById('camera-canvas');
  if (!openBtn || !cameraSection || !video || !captureBtn || !canvas) return;
  let stream = null;
  openBtn.onclick = async () => {
    cameraSection.style.display = 'flex';
    document.getElementById('scan-preview').innerHTML = '';
    document.getElementById('scan-result').textContent = '';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
    } catch (e) {
      document.getElementById('scan-result').textContent = 'Camera access denied.';
    }
  };
  captureBtn.onclick = async () => {
    if (!stream) return;
    canvas.style.display = 'block';
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    // Stop camera after capture
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    cameraSection.style.display = 'none';
    // Show preview
    const dataUrl = canvas.toDataURL();
    document.getElementById('scan-preview').innerHTML = `<img src="${dataUrl}" alt="Preview" style="max-width:220px; max-height:180px; border-radius:8px; box-shadow:0 2px 8px #aaa;">`;
    // Send image to external API for recognition
    showScanResult('Analyzing image...');
    try {
      const info = await recognizeImageWithAPI(dataUrl);
      showScanResult(info);
    } catch (e) {
      showScanResult('Could not analyze image. Please try again.');
    }
  };
}

// Example: Send image to an external API and return information
async function recognizeImageWithAPI(dataUrl) {
  // Replace the following with your real API endpoint and key
  const apiEndpoint = 'https://your-image-recognition-api.com/recognize';
  const apiKey = 'YOUR_API_KEY';
  // Convert dataURL to base64 string (remove prefix)
  const base64Image = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, '');
  // Example POST request
  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ image: base64Image })
  });
  if (!response.ok) throw new Error('API error');
  const result = await response.json();
  // Customize this to match your API response structure
  if (result && result.name) {
    return `Product: <b>${result.name}</b><br>Details: ${result.details || 'No details available.'}`;
  }
  return 'No recognizable product found.';
}


// Demo product database
const productDB = [
  {
    name: 'Rice',
    price: '₹40/kg',
    season: 'June - November',
    beed: 'IR64, Basmati, Sona Masuri',
    analysis: 'Rice is best grown in monsoon. Ensure proper irrigation and pest control for high yield.'
  },
  {
    name: 'Wheat',
    price: '₹28/kg',
    season: 'November - April',
    beed: 'HD2967, PBW343',
    analysis: 'Wheat prefers cool, dry weather. Use certified seeds for better productivity.'
  },
  {
    name: 'Tomato',
    price: '₹25/kg',
    season: 'October - February',
    beed: 'Pusa Ruby, Arka Vikas',
    analysis: 'Tomatoes need well-drained soil and regular watering. Watch for blight and fruit borer.'
  },
  {
    name: 'Potato',
    price: '₹20/kg',
    season: 'October - March',
    beed: 'Kufri Jyoti, Kufri Bahar',
    analysis: 'Potatoes require loose, fertile soil. Avoid waterlogging and use disease-free tubers.'
  },
  {
    name: 'Onion',
    price: '₹30/kg',
    season: 'October - December',
    beed: 'N-53, Agrifound Dark Red',
    analysis: 'Onions need moderate temperature and good drainage. Use organic manure for better bulbs.'
  },
  {
    name: 'Maize (Corn)',
    price: '₹22/kg',
    season: 'June - September',
    beed: 'HQPM-1, Bio9637',
    analysis: 'Maize grows well in warm, moist conditions. Timely sowing and weed control are essential.'
  }
];


// Load TensorFlow.js model (replace 'model/model.json' with your real model path)
let cropModel = null;
async function loadCropModel() {
  if (!cropModel) {
    try {
      cropModel = await tf.loadLayersModel('model/model.json');
    } catch (e) {
      console.warn('Could not load model:', e);
      cropModel = null;
    }
  }
  return cropModel;
}

// Map model prediction index to productDB index (adjust as per your model's classes)
function getProductByPrediction(predIdx) {
  return productDB[predIdx] || { name: 'Unknown', price: '-', season: '-', beed: '-', analysis: 'No data available.' };
}

// Real CNN analysis using TensorFlow.js model
async function analyzeImageCNN(canvas) {
  showScanResult('Analyzing image with AI model...');
  const imgTensor = tf.browser.fromPixels(canvas).resizeNearestNeighbor([64,64]).toFloat().div(255.0).expandDims(0);
  const model = await loadCropModel();
  if (model) {
    try {
      const prediction = model.predict(imgTensor);
      const predIdx = prediction.argMax(-1).dataSync()[0];
      const product = getProductByPrediction(predIdx);
      showScanResult(
        `Product: <b>${product.name}</b><br>` +
        `Price: <b>${product.price}</b><br>` +
        `Best Season: <b>${product.season}</b><br>` +
        `Seed/Beed: <b>${product.beed}</b><br>` +
        `Analysis: <span style="color:#0a5">${product.analysis}</span>`
      );
      prediction.dispose && prediction.dispose();
    } catch (e) {
      showScanResult('Model prediction failed.');
    }
  } else {
    showScanResult('AI model not found. Please add your model to /model/model.json');
  }
  imgTensor.dispose();
}

let allItems = [];
let foodItems = [];

async function loadAllItems() {
  try {
    const res = await fetch('items.json');
    const data = await res.json();
    // Merge all categories into one array for gallery
    allItems = [
      ...(data.vegetables || []),
      ...(data.flowers || []),
      ...(data.foods || [])
    ];
    foodItems = allItems;
    renderFoodGallery();
  } catch (e) {
    document.getElementById('food-gallery').innerHTML = '<div style="color:#a00;">Could not load items.json</div>';
  }
}


function renderFoodGallery(filter = '') {
  const gallery = document.getElementById('food-gallery');
  let items = foodItems;
  if (filter) {
    const f = filter.trim().toLowerCase();
    items = foodItems.filter(item => {
      const nameMatch = item.name.toLowerCase().includes(f);
      const infoMatch = item.info && item.info.toLowerCase().includes(f);
      const priceMatch = item.price !== undefined && item.price.toString().includes(f);
      return nameMatch || infoMatch || priceMatch;
    });
  }
  if (items.length === 0) {
    gallery.innerHTML = '<div style="color:#a00; font-size:1.1em;">No items found.</div>';
    return;
  }
  gallery.innerHTML = items.map((item, idx) => `
    <div class="food-item" onclick="showFoodInfoByName('${item.name.replace(/'/g, "\\'")}')">
      <img src="${item.image}" alt="${item.name}">
      <h3>${item.name}</h3>
      ${item.price !== undefined ? `<div style='color:#0a5; font-weight:bold;'>₹${item.price}/kg</div>` : ''}
    </div>
  `).join('');
}

function showFoodInfoByName(name) {
  const idx = foodItems.findIndex(item => item.name === name);
  if (idx !== -1) showFoodInfo(idx);
}

function showFoodInfo(idx) {
  const item = foodItems[idx];
  document.getElementById('modal-title').textContent = item.name;
  document.getElementById('modal-img').src = item.image;
  let infoHtml = item.info;
  if (item.price !== undefined) {
    infoHtml += `<br><b style='color:#0a5;'>Price: ₹${item.price}/kg</b>`;
  }
  if (item.lastUpdated) {
    infoHtml += `<br><span style='color:#888; font-size:0.95em;'>Last updated: ${item.lastUpdated}</span>`;
  }
  document.getElementById('modal-info').innerHTML = infoHtml;
  document.getElementById('food-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('food-modal').style.display = 'none';
}


// Weather/location logic
function showWeatherInfo(text) {
  const el = document.getElementById('weather-info');
  if (el) el.textContent = text;
}


// Get city/location name from coordinates using Nominatim reverse geocoding

async function fetchLocationName(lat, lon, callback) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Agri365/1.0' } });
    const data = await res.json();
    let name = '';
    if (data.address) {
      name = data.address.city || data.address.town || data.address.village || data.address.hamlet || data.address.county || data.address.state || data.address.country || '';
    }
    callback(name);
  } catch (e) {
    callback('');
  }
}

function fetchWeather(lat, lon) {
  // Open-Meteo API: https://open-meteo.com/en/docs
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data && data.current_weather) {
        const temp = data.current_weather.temperature;
        fetchLocationName(lat, lon, (locName) => {
          showWeatherInfo(`Location: ${locName ? locName + ' ' : ''}(${lat.toFixed(2)}, ${lon.toFixed(2)}) | Temperature: ${temp}°C`);
        });
      } else {
        showWeatherInfo('Weather data unavailable.');
      }
    })
    .catch(() => showWeatherInfo('Unable to fetch weather.'));
}


function getLocationAndWeather() {
  if (!navigator.geolocation) {
    showWeatherInfo('Geolocation not supported.');
    return;
  }
  showWeatherInfo('Fetching location and weather...');
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      if (latitude && longitude) {
        fetchWeather(latitude, longitude);
      } else {
        showWeatherInfo('Could not determine coordinates.');
      }
    },
    err => {
      let msg = 'Location access denied.';
      if (err && err.message) msg += ' ' + err.message;
      showWeatherInfo(msg);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}


// AI image scan logic
function showScanResult(text) {
  document.getElementById('scan-result').innerHTML = text;
}

function previewImage(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('scan-preview').innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width:220px; max-height:180px; border-radius:8px; box-shadow:0 2px 8px #aaa;">`;
  };
  reader.readAsDataURL(file);
}

async function analyzeImageAI(file) {
  showScanResult('Analyzing image with AI...');
  // Placeholder: Integrate with real AI API here (e.g., PlantVillage, Roboflow, HuggingFace, etc.)
  // For now, just simulate a result
  setTimeout(() => {
    showScanResult('No visible problems detected. (AI demo)');
  }, 1800);
}

function setupScanImage() {
  const input = document.getElementById('scan-image');
  if (!input) return;
  input.addEventListener('change', function() {
    const file = this.files && this.files[0];
    if (!file) return;
    previewImage(file);
    analyzeImageAI(file);
  });
}



document.addEventListener('DOMContentLoaded', () => {
  loadAllItems();
  getLocationAndWeather();
  setupScanImage();
  setupCameraScanner();
  const searchBar = document.getElementById('search-bar');
  if (searchBar) {
    searchBar.addEventListener('input', e => {
      renderFoodGallery(e.target.value);
    });
  }
  const priceSearchBar = document.getElementById('price-search-bar');
  if (priceSearchBar) {
    priceSearchBar.addEventListener('input', e => {
      renderFoodGallery(e.target.value);
    });
  }
});
