"use strict";

Cesium.MapboxApi.defaultAccessToken = 'pk.eyJ1IjoiYWxkZWJybiIsImEiOiJjaWk2dXhpZWowMXU4dHdrZmZobDlvMzh2In0.dc7AbJYbRmEXBUWA3lgygQ';
Cesium.BingMapsApi.defaultKey = 'AtxCXVrmWBEbPPkiEssyaXHct5S9N9-vAJnHEVrV5vVpvDFLsENIXMfu8nekFrZn';

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

// The Black Marble model from Cesium (https://cesiumjs.org/data-and-assets/imagery/black-marble/)
// is sometimes blocked due to CORS, so load it from GitHub Pages.
var models = Cesium.createDefaultImageryProviderViewModels()
    .filter(function (model) {
        return model.name.toLowerCase().indexOf('black marble') < 0;
    });
var model = new Cesium.ProviderViewModel({
    name: "Black Marble Night Lights",
    iconUrl: "Build/Cesium/Widgets/Images/ImageryProviders/blackMarble.png",
    tooltip: "Nighttime view of the Earth, collected by the Suomi NPP satellite in 2012",
    creationFunction: function () {
        return Cesium.createTileMapServiceImageryProvider({
            url: '//fasiha.github.io/nasa-black-marble-tiles',
            credit: new Cesium.Credit('NASA Night Lights 2012', '', '')
        });
    }
});
models.push(model);

// Initialize the viewer
var viewer = new Cesium.Viewer('cesiumContainer', {
    imageryProviderViewModels: models,
    contextOptions: { webgl: { preserveDrawingBuffer: true } },
    animation: false,
    timeline: false,
    terrainExaggeration: savedParametersObj ? +savedParametersObj.terrainExaggeration || 1 : 1
});
var imageryLayers = viewer.imageryLayers;

// Add the texshade
function addAdditionalLayerOption(name, imageryProvider, alpha, contrast, show) {
    var layer = imageryLayers.addImageryProvider(imageryProvider);
    layer.alpha = Cesium.defaultValue(alpha, 0.5);
    layer.contrast = Cesium.defaultValue(contrast, 1.0);
    layer.show = Cesium.defaultValue(show, true);
    layer.name = name;
    Cesium.knockout.track(layer, ['alpha', 'show', 'name']);
    return layer;
}
var tmsProvider = Cesium.createTileMapServiceImageryProvider({
    url: '//d2i33ldayhex0u.cloudfront.net/world-tex-cgiar-90m',
    credit: new Cesium.Credit('Ahmed Fasih, CGIAR-SRTM 90m'),
    flipXY: true
});
var tms = addAdditionalLayerOption('TMS', tmsProvider, 0.75, 1.4);

// Set up the Knockout part of the app, controlling texture and basemap colors
// The viewModel tracks the state of our mini application.
var viewModel = {
    brightness: 0,
    contrast: 0,
    hue: 0,
    saturation: 0,
    gamma: 0,
    texbrightness: 0,
    texcontrast: 0,
    texhue: 0,
    texsaturation: 0,
    texgamma: 0,
    texalpha: 0,
    cameraLat: 0,
    cameraLon: 0,
    cameraHeight: 0,
    displayCameraHeight: function displayCameraHeight(h) {
        return h < 1e3 ? h.toFixed(1) + ' m' : (h / 1e3).toFixed(1) + ' km';
    },
    displayCameraLatLon: function displayCameraLatLon(lat, lon) {
        return Math.abs(lat).toFixed(3) + '° ' + (lat > 0 ? 'N' : 'S') + ', ' + Math.abs(lon).toFixed(3) + '° ' + (lon > 0 ? 'E' : 'W');
    },
    serializeView: function serializeView() {
        return _serializeView(viewer);
    }
};
// Convert the viewModel members into knockout observables.
Cesium.knockout.track(viewModel);

// Bind the viewModel to the DOM elements of the UI that call for it.
var toolbar = document.getElementById('toolbar');
Cesium.knockout.applyBindings(viewModel, toolbar);
// Make the active imagery layer a subscriber of the viewModel.
function subscribeLayerParameter(name) {
    Cesium.knockout.getObservable(viewModel, name).subscribe(function (newValue) {
        var finalName = name.replace('tex', '');
        _.range(imageryLayers.length).map(function (i) {
            return imageryLayers.get(i);
        }).filter(function (o) {
            return o.isBaseLayer() === name.indexOf('tex') < 0;
        }).forEach(function (o) {
            o[finalName] = newValue;
        });
    });
}
subscribeLayerParameter('brightness');
subscribeLayerParameter('contrast');
subscribeLayerParameter('hue');
subscribeLayerParameter('saturation');
subscribeLayerParameter('gamma');
subscribeLayerParameter('texbrightness');
subscribeLayerParameter('texcontrast');
subscribeLayerParameter('texhue');
subscribeLayerParameter('texsaturation');
subscribeLayerParameter('texgamma');
subscribeLayerParameter('texalpha');

// Make the viewModel react to base layer changes.
function updateViewModel() {
    _.range(imageryLayers.length).map(function (i) {
        return imageryLayers.get(i);
    }).forEach(function (o) {
        if (o.isBaseLayer()) {
            viewModel.brightness = o.brightness;
            viewModel.contrast = o.contrast;
            viewModel.hue = o.hue;
            viewModel.saturation = o.saturation;
            viewModel.gamma = o.gamma;
        } else {
            viewModel.texbrightness = o.brightness;
            viewModel.texcontrast = o.contrast;
            viewModel.texhue = o.hue;
            viewModel.texsaturation = o.saturation;
            viewModel.texgamma = o.gamma;
            viewModel.texalpha = o.alpha;
        }
    });
    viewModel.cameraLat = Cesium.Math.toDegrees(viewer.scene.camera.positionCartographic.latitude);
    viewModel.cameraLon = Cesium.Math.toDegrees(viewer.scene.camera.positionCartographic.longitude);
    viewModel.cameraHeight = viewer.scene.camera.positionCartographic.height;
}
imageryLayers.layerAdded.addEventListener(updateViewModel);
imageryLayers.layerRemoved.addEventListener(updateViewModel);
imageryLayers.layerMoved.addEventListener(updateViewModel);
viewer.camera.moveEnd.addEventListener(updateViewModel);
updateViewModel();

// Serialize the view
function _serializeView(viewer) {
    var baseLayerPicked = {
        name: viewer.baseLayerPicker.viewModel.selectedImagery.name,
        iconUrl: viewer.baseLayerPicker.viewModel.selectedImagery.iconUrl
    };
    var baseTerrainPicked = {
        name: viewer.baseLayerPicker.viewModel.selectedTerrain.name
    };
    var layers = _.range(viewer.imageryLayers.length).map(function (n) {
        return viewer.imageryLayers.get(n);
    }).map(function (o) {
        return {
            url: o.imageryProvider.url,
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
        version: 0,
        baseLayerPicked: baseLayerPicked,
        baseTerrainPicked: baseTerrainPicked,
        layers: layers,
        terrainExaggeration: +viewer.scene.terrainExaggeration,
        destination: new Cesium.Cartesian3(viewer.camera.position.x, viewer.camera.position.y, viewer.camera.position.z),
        orientation: {
            heading: viewer.camera.heading,
            pitch: viewer.camera.pitch,
            roll: viewer.camera.roll
        }
    };
    window.location.hash = encodeURIComponent(JSON.stringify(obj));
    return obj;
}

function deserializeView(viewer, obj) {
    // Set the camera
    viewer.camera.setView({
        destination: new Cesium.Cartesian3(obj.destination.x, obj.destination.y, obj.destination.z),
        orientation: obj.orientation
    });
    // Set the BaseLayerPicker state
    if (obj.baseLayerPicked) {
        viewer.baseLayerPicker.viewModel.imageryProviderViewModels.filter(function (o) {
            return o.name === obj.baseLayerPicked.name;
        }).forEach(function (o, i) {
            if (i === 0) {
                viewer.baseLayerPicker.viewModel.selectedImagery = o;
            }
        });
    }
    if (obj.baseTerrainPicked) {
        viewer.baseLayerPicker.viewModel.terrainProviderViewModels.filter(function (o) {
            return o.name === obj.baseTerrainPicked.name;
        }).forEach(function (o, i) {
            if (i === 0) {
                viewer.baseLayerPicker.viewModel.selectedTerrain = o;
            }
        });
    }
    // Set the layer parameters: get the first base layer and first non-base-layer
    // from obj and the current
    function updateLayerParameters(source, dest) {
        dest.alpha = +source.alpha;
        dest.brightness = +source.brightness;
        dest.contrast = +source.contrast;
        dest.hue = +source.hue;
        dest.saturation = +source.saturation;
        dest.gamma = +source.gamma;
    }
    var referenceBaseLayer = obj.layers.filter(function (o) {
        return o.isBaseLayer;
    })[0];
    var currentBaseLayer = _.range(viewer.imageryLayers.length).map(function (n) {
        return viewer.imageryLayers.get(n);
    }).filter(function (o) {
        return o.isBaseLayer();
    })[0];
    if (referenceBaseLayer && currentBaseLayer) {
        updateLayerParameters(referenceBaseLayer, currentBaseLayer);
    }
    var referenceNonBaseLayer = obj.layers.filter(function (o) {
        return !o.isBaseLayer;
    })[0];
    var currentNonBaseLayer = _.range(viewer.imageryLayers.length).map(function (n) {
        return viewer.imageryLayers.get(n);
    }).filter(function (o) {
        return !o.isBaseLayer();
    })[0];
    if (referenceNonBaseLayer && currentNonBaseLayer) {
        updateLayerParameters(referenceNonBaseLayer, currentNonBaseLayer);
    }
}

// Setup done, fly to an interest scene or parse the URL hash
if (savedParametersObj) {
    deserializeView(viewer, savedParametersObj);
} else {
    viewer.camera.flyTo({
        duration: 1,
        destination: Cesium.Cartesian3.fromDegrees(137, 37, 1768853)
    });
}

