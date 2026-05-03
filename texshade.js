"use strict";

Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5Y2IzYTViZi0yMjE3LTRhNTUtYjNhZi01NjY0OTliYjUyYjEiLCJpZCI6NDI2NTkzLCJpc3MiOiJodHRwczovL2lvbi5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3Nzc3NzU2NTF9.3xn8pWltJ0cs4r7G9nFzFGeu_VJr_jL6aVH6dGaPWBI";
Cesium.ArcGisMapService.defaultAccessToken = "AAPTaUSghBowjL50vx1l6eKhT6A..3OMraz_BmIsSGx-8mW4zbqSXuZiGUfV8MJmS1vg9gTNQRehFy0YcH4ek6pTEAzo8qYgiUiTWvquDsD2O5htfEnLbfrq6U0wfby_ucjhlK6Og-gZHtk4C8qE3eAfFenXvrkVVrGWVPgJ7bTxUfVNxltwfEnMRIdC7ul_AU8fp_lbSVL4yf4zVjkbCK7DfX6rtZTk9pNZETT5Cgh4uHD1cT6Ksg9tUAeRkPHxGevWoDbQFFtnBkorf1g..AT1_RaglvLrI";

// Does the URL have an object encoded in it?
var savedParametersObj = undefined;
if (window.location.hash.length > 0) {
    try {
        savedParametersObj = JSON.parse(decodeURIComponent(window.location.hash.slice(1)));
    } catch (e) {
        console.error('Problem parsing URL hash!', e);
    } finally {
        window.location.hash = '';
    }
}

// Build imagery provider list, filtering out providers that need expired API keys
var models = Cesium.createDefaultImageryProviderViewModels()
    .filter(function (model) {
        var name = model.name.toLowerCase();
        return name.indexOf('bing') < 0 && name.indexOf('mapbox') < 0 && model.category !== 'Cesium ion';
    });
var blackMarbleModel = new Cesium.ProviderViewModel({
    category: 'Other',
    name: "Black Marble Night Lights",
    iconUrl: "Build/Cesium/Widgets/Images/ImageryProviders/blueMarble.png",
    tooltip: "Nighttime view of the Earth, collected by the Suomi NPP satellite in 2012",
    creationFunction: function () {
        return Cesium.TileMapServiceImageryProvider.fromUrl('https://fasiha.github.io/nasa-black-marble-tiles', {
            credit: new Cesium.Credit('NASA Night Lights 2012')
        });
    }
});
models.push(blackMarbleModel);

// Initialize the viewer
var viewer = new Cesium.Viewer('cesiumContainer', {
    imageryProviderViewModels: models,
    selectedImageryProviderViewModel: models[0],
    contextOptions: { webgl: { preserveDrawingBuffer: true } },
    animation: false,
    timeline: false,
});
var imageryLayers = viewer.imageryLayers;

// Add the texshade overlay
var tms;
Cesium.TileMapServiceImageryProvider.fromUrl('https://d2i33ldayhex0u.cloudfront.net/world-tex-cgiar-90m', {
    credit: new Cesium.Credit('Ahmed Fasih, CGIAR-SRTM 90m'),
    flipXY: true,
}).then(function (tmsProvider) {
    tms = imageryLayers.addImageryProvider(tmsProvider);
    var savedTex = savedParametersObj && savedParametersObj.layers &&
        savedParametersObj.layers.filter(function (l) { return !l.isBaseLayer; })[0];
    if (savedTex) {
        tms.alpha      = +savedTex.alpha;
        tms.brightness = +savedTex.brightness;
        tms.contrast   = +savedTex.contrast;
        tms.hue        = +savedTex.hue;
        tms.saturation = +savedTex.saturation;
        tms.gamma      = +savedTex.gamma;
    } else {
        tms.alpha = 0.75;
        tms.contrast = 1.4;
    }
    syncUIFromLayers();
});

// --- Layer helpers ---

function getBaseLayers() {
    return _.range(imageryLayers.length).map(function (i) { return imageryLayers.get(i); })
        .filter(function (l) { return l.isBaseLayer(); });
}

function getNonBaseLayers() {
    return _.range(imageryLayers.length).map(function (i) { return imageryLayers.get(i); })
        .filter(function (l) { return !l.isBaseLayer(); });
}

function applyToLayers(layerGroup, param, value) {
    var layers = layerGroup === 'base' ? getBaseLayers() : getNonBaseLayers();
    layers.forEach(function (l) { l[param] = +value; });
}

// --- UI wiring ---

// For each [param, layer] pair, keep range and text in sync and apply to Cesium layers
var inputs = document.querySelectorAll('#toolbar input[data-param]');
inputs.forEach(function (input) {
    input.addEventListener('input', function () {
        var param = input.dataset.param;
        var layer = input.dataset.layer;
        var value = input.value;
        // Sync the sibling input (range ↔ text)
        document.querySelectorAll('#toolbar input[data-param="' + param + '"][data-layer="' + layer + '"]')
            .forEach(function (sibling) { sibling.value = value; });
        applyToLayers(layer, param, value);
    });
});

document.getElementById('permalink-button').addEventListener('click', function () {
    var obj = serializeView();
    if (!obj) return;
    var url = location.href;
    navigator.clipboard.writeText(url).then(function () {
        var btn = document.getElementById('permalink-button');
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function () {
            btn.textContent = 'Permalink';
            btn.classList.remove('copied');
        }, 1500);
    }).catch(function () {
        // clipboard blocked (non-https etc) — URL is still in the hash, user can copy manually
    });
});

// Sync UI inputs from current layer state
function syncUIFromLayers() {
    var base = getBaseLayers()[0];
    var tex = getNonBaseLayers()[0];
    var vals = {
        base: base ? { brightness: base.brightness, contrast: base.contrast, hue: base.hue, saturation: base.saturation, gamma: base.gamma } : null,
        tex:  tex  ? { brightness: tex.brightness,  contrast: tex.contrast,  gamma: tex.gamma, alpha: tex.alpha } : null,
    };
    Object.keys(vals).forEach(function (layer) {
        if (!vals[layer]) return;
        Object.keys(vals[layer]).forEach(function (param) {
            var v = (+vals[layer][param]).toFixed(2);
            document.querySelectorAll('#toolbar input[data-param="' + param + '"][data-layer="' + layer + '"]')
                .forEach(function (el) { el.value = v; });
        });
    });
}

// Update camera display and sync UI when base layer changes
function onLayerChange() {
    syncUIFromLayers();
}
imageryLayers.layerAdded.addEventListener(onLayerChange);
imageryLayers.layerRemoved.addEventListener(onLayerChange);
imageryLayers.layerMoved.addEventListener(onLayerChange);

viewer.camera.moveEnd.addEventListener(function () {
    var cart = viewer.scene.camera.positionCartographic;
    var lat = Cesium.Math.toDegrees(cart.latitude);
    var lon = Cesium.Math.toDegrees(cart.longitude);
    var h = cart.height;
    var heightStr = h < 1e3 ? h.toFixed(1) + ' m' : (h / 1e3).toFixed(1) + ' km';
    document.getElementById('camera-latlonheight').textContent =
        Math.abs(lat).toFixed(2) + '° ' + (lat > 0 ? 'N' : 'S') + ', ' +
        Math.abs(lon).toFixed(2) + '° ' + (lon > 0 ? 'E' : 'W') + '. Height: ' + heightStr;
});

// --- Serialize / deserialize ---

function serializeView() {
    try {
        var selectedImagery = viewer.baseLayerPicker.viewModel.selectedImagery;
        var baseLayerPicked = { name: selectedImagery.name };
        var selectedTerrain = viewer.baseLayerPicker.viewModel.selectedTerrain;
        var baseTerrainPicked = selectedTerrain ? { name: selectedTerrain.name } : null;
        var layers = _.range(imageryLayers.length).map(function (n) {
            var o = imageryLayers.get(n);
            return {
                isBaseLayer: o.isBaseLayer(),
                alpha: +o.alpha,
                brightness: +o.brightness,
                contrast: +o.contrast,
                hue: +o.hue,
                saturation: +o.saturation,
                gamma: +o.gamma
            };
        });
        var obj = {
            version: 1,
            baseLayerPicked: baseLayerPicked,
            baseTerrainPicked: baseTerrainPicked,
            layers: layers,
            destination: { x: viewer.camera.position.x, y: viewer.camera.position.y, z: viewer.camera.position.z },
            orientation: { heading: viewer.camera.heading, pitch: viewer.camera.pitch, roll: viewer.camera.roll }
        };
        window.location.hash = encodeURIComponent(JSON.stringify(obj));
        return obj;
    } catch (e) {
        console.error('serializeView failed:', e);
    }
}

function deserializeView(obj) {
    viewer.camera.setView({
        destination: new Cesium.Cartesian3(obj.destination.x, obj.destination.y, obj.destination.z),
        orientation: obj.orientation
    });
    if (obj.baseLayerPicked) {
        viewer.baseLayerPicker.viewModel.imageryProviderViewModels
            .filter(function (o) { return o.name === obj.baseLayerPicked.name; })
            .forEach(function (o, i) { if (i === 0) viewer.baseLayerPicker.viewModel.selectedImagery = o; });
    }
    if (obj.baseTerrainPicked) {
        viewer.baseLayerPicker.viewModel.terrainProviderViewModels
            .filter(function (o) { return o.name === obj.baseTerrainPicked.name; })
            .forEach(function (o, i) { if (i === 0) viewer.baseLayerPicker.viewModel.selectedTerrain = o; });
    }
    function applyLayerParams(source, dest) {
        dest.alpha      = +source.alpha;
        dest.brightness = +source.brightness;
        dest.contrast   = +source.contrast;
        dest.hue        = +source.hue;
        dest.saturation = +source.saturation;
        dest.gamma      = +source.gamma;
    }
    var refBase = obj.layers.filter(function (o) { return o.isBaseLayer; })[0];
    var curBase = getBaseLayers()[0];
    if (refBase && curBase) applyLayerParams(refBase, curBase);

    var refTex = obj.layers.filter(function (o) { return !o.isBaseLayer; })[0];
    var curTex = getNonBaseLayers()[0];
    if (refTex && curTex) applyLayerParams(refTex, curTex);

    syncUIFromLayers();
}

// --- Startup ---

if (savedParametersObj) {
    deserializeView(savedParametersObj);
} else {
    viewer.camera.flyTo({
        duration: 1,
        destination: Cesium.Cartesian3.fromDegrees(137, 37, 1768853)
    });
}
