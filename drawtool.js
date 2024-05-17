//import { red, green, blue } from "./coolwarm.js"
import { state, mats, waitFor, drawArrow } from "./helpers.js"
import { onScreenCVS,onScreenCTX,offScreenCVS,offScreenCTX,magCVS,magCTX } from "./canvas.js"
import { dwAngleGenerator, findContours, matToImageData, imageDataToDataURL} from "./opencv_helpers.js"

//====================================//
//======= * * * Toolbar * * * ========//
//====================================//

// * Canvas Size Input * //
const canvasWidthInput = document.getElementById("canvasWidthInput");
const canvasHeightInput = document.getElementById("canvasHeightInput");
// * All tool buttons * //
const toolBtns = document.querySelectorAll('.toolBtn');
let toolBtnImg = document.getElementById('pantoolImg');
// * Pan button * //
const panBtn = document.getElementById("pantool")
// * Undo buttons * //
const undoBtn = document.getElementById("undo")
const redoBtn = document.getElementById("redo")
// * Reset buttons * //
const clearBtn = document.getElementById("clear")
// * Zoom buttons * //
const zoomInBtn = document.getElementById("zoomIn")
const zoomOutBtn = document.getElementById("zoomOut")
// * Drawing * //
const drawBtn = document.getElementById("drawtool")
const eraseBtn = document.getElementById("erasetool")
// * Line Width * //
const lineWidthInput = document.getElementById("lineWidth")
let lineWidth = 32;
// * Domain Wall Width * //
const dwThicknessInput = document.getElementById("dwThickness")
let dwThickness = 31;
// * Placing Blochlines * //
const placeBlochlineBtn = document.getElementById("bltool")

const tools = {
  pantool: {
      name: "pantool",
      //fn: handleDrag,
      onetime: false,
  },
  drawtool: {
      name: "pen",
      //fn: actionDraw,
      brushSize: 16,
      color: "black",
      onetime: false,
  },
  erasetool: {
      name: "eraser",
      //fn: actionDraw,
      brushSize: 16,
      color: "white",
      onetime: false,
  },
  zoomIn: {
      name: "zoomIn",
      //fn: handleZoom,
      z: 1.25,
      onetime: true,
  },
  zoomOut: {
      name: "zoomOut",
      //fn: handleZoom,
      z: 0.8,
      onetime: true,
  },
  undo: {
      name: "undo",
      //fn: handleUndo,
      onetime: true,
  },
  redo: {
      name: "redo",
      //fn: handleRedo,
      onetime: true,
  },
};

//====================================//
//======= * * * Rendering * * * ======//
//====================================//

//Set initial size of canvas. If using a non-square, make sure to set the ratio the same as the offscreen canvas by multiplying either the height or width by the correct ratio.
let baseDimensionX;
let baseDimensionY;
let rect;
initializeOnScreenCanvas();
onScreenCVS.width = baseDimensionX;
onScreenCVS.height = baseDimensionY;
magCVS.width = baseDimensionX;
magCVS.height = baseDimensionY;
let img = new Image();
let source = offScreenCVS.toDataURL();
let magImg = new Image();
let magSource = offScreenCVS.toDataURL();
startOpenCV();

async function renderBoth(redraw = true, blur = true) {
  state.updatingDone = false;
  renderImage();
  renderMagImage(redraw,blur);
}

//Once the image is loaded, draw the image onto the onscreen canvas.
async function renderImage() {
  img.src = source;
  img.onload = () => {
    //if the image is being drawn due to resizing, reset the width and height. Putting the width and height outside the img.onload function will make scaling smoother, but the image will flicker as you scale. Pick your poison.
    onScreenCVS.width = baseDimensionX;
    onScreenCVS.height = baseDimensionY;
    //Prevent blurring
    onScreenCTX.imageSmoothingEnabled = false;
    onScreenCTX.drawImage(img, 0, 0, onScreenCVS.width, onScreenCVS.height);
    state.updatingDone = true;
  };
}

//Once the image is loaded, draw the image onto the onscreen canvas.
async function renderMagImage(redraw = true, blur = true) {
  if (redraw === true) {
    magSource = await drawMagSource(blur);
    magImg.src = magSource;
    magImg.onload = () => {
      //if the image is being drawn due to resizing, reset the width and height. Putting the width and height outside the img.onload function will make scaling smoother, but the image will flicker as you scale. Pick your poison.
      magCVS.width = baseDimensionX;
      magCVS.height = baseDimensionY;
      //Prevent blurring
      magCTX.imageSmoothingEnabled = false;
      magCTX.drawImage(magImg, 0, 0, magCVS.width, magCVS.height);
      generatePreviewArrows();
      console.log("Mag image posted")
    };
  } else if (redraw === false) {
    //if the image is being drawn due to resizing, reset the width and height. Putting the width and height outside the img.onload function will make scaling smoother, but the image will flicker as you scale. Pick your poison.
    magCVS.width = baseDimensionX;
    magCVS.height = baseDimensionY;
    //Prevent blurring
    magCTX.imageSmoothingEnabled = false;
    magCTX.drawImage(magImg, 0, 0, magCVS.width, magCVS.height);
    console.log("Mag image posted")
  }
}

//Get the size of the parentNode which is subject to flexbox. Fit the square by making sure the dimensions are based on the smaller of the width and height.
function initializeOnScreenCanvas() {
  rect = onScreenCVS.parentNode.getBoundingClientRect();
  let rectAspectRatio = rect.height/rect.width;
  let offScreenAspectRatio = offScreenCVS.height / offScreenCVS.width
  let canvasBuffer = 4;
  let displayAspectRatio = (offScreenCVS.height)/(2*offScreenCVS.width+canvasBuffer);
  if (rectAspectRatio > displayAspectRatio) {
    baseDimensionX = ((rect.width-canvasBuffer)/2)
    baseDimensionY = Math.floor(baseDimensionX * offScreenAspectRatio)
  } else {
    baseDimensionY = rect.height
    baseDimensionX = Math.floor(baseDimensionY / offScreenAspectRatio)
  }
}

//Resize the canvas if the window is resized
function flexCanvasSize() {
  initializeOnScreenCanvas();
  renderBoth(false, false);
}

//Add event listeners for canvas resizing
canvasWidthInput.addEventListener('change', e => {
  offScreenCVS.width = e.target.value;
  initializeOnScreenCanvas();
  resetOffScreenCVS();
});
canvasHeightInput.addEventListener('change', e => {
  offScreenCVS.height = e.target.value;
  initializeOnScreenCanvas();
  resetOffScreenCVS();
});

//====================================//
//========= * * * Reset * * * ========//
//====================================//

//Provide image reset functionality
clearBtn.addEventListener('click', e => {
  resetOffScreenCVS();
});

function resetOffScreenCVS() {
  offScreenCTX.fillStyle = 'white';
  offScreenCTX.fillRect(0, 0, offScreenCVS.width, offScreenCVS.height);
  undoStack = [];
  redoStack = [];
  points = [];
  source = offScreenCVS.toDataURL();
  renderBoth(true, false); // set to redraw true and redrawArrows true when domain wall rendering is finished
}

//====================================//
//======= * * * Undo/Redo * * * ======//
//====================================//

//Create history stacks for the undo functionality
let undoStack = [];
let redoStack = [];
let lastX;
let lastY;
let points = [];

//Add event listeners for the undo/redo buttons
undoBtn.addEventListener("click", handleUndo);
redoBtn.addEventListener("click", handleRedo);

function handleUndo() {
  if (undoStack.length > 0) {
    actionUndoRedo(redoStack, undoStack);
  }
}

function handleRedo() {
  if (redoStack.length >= 1) {
    actionUndoRedo(undoStack, redoStack);
  }
}

//Undo or redo an action
function actionUndoRedo(pushStack, popStack) {
  pushStack.push(popStack.pop());
  offScreenCTX.fillStyle = 'white';
  offScreenCTX.fillRect(0, 0, offScreenCVS.width, offScreenCVS.height);
  redrawPoints();
  source = offScreenCVS.toDataURL();
  renderBoth(true, true);
}

function redrawPoints() {
  undoStack.forEach((s) => {
    s.forEach((p) => {
      if (p.type === true) {
        offScreenCTX.strokeStyle = "black";
      } else {
        offScreenCTX.strokeStyle = "white";
      }
      offScreenCTX.lineWidth = p.size;
      offScreenCTX.lineCap = 'round';
      offScreenCTX.beginPath();
      offScreenCTX.moveTo(p.x0,p.y0)
      offScreenCTX.lineTo(p.x1,p.y1);
      offScreenCTX.stroke();
      });
  });
}

//====================================//
//======== * * * Actions * * * =======//
//====================================//

let firstX;
let firstY;

//Add event listeners for the mouse moving, downclick, and upclick
onScreenCVS.addEventListener("mousemove", handleMouseMove);
onScreenCVS.addEventListener("mousedown", handleMouseDown);
onScreenCVS.addEventListener("mouseup", handleMouseUp);

//We only want the mouse to move if the mouse is down, so we need a variable to disable drawing while the mouse is not clicked.
let clicked = false;
let isDrawing = true;
let isErasing = false;
let isPanning = false;

drawBtn.addEventListener('click', e => {
  isDrawing = true;
  isErasing = false;
  isPanning = false;

});

eraseBtn.addEventListener('click', e => {
  isDrawing = false;
  isErasing = true;
  isPanning = false;
});

panBtn.addEventListener('click', e => {
  isDrawing = false;
  isErasing = false;
  isPanning = true;
});

lineWidthInput.addEventListener('change', e => {
  lineWidth = e.target.value;
});

dwThicknessInput.addEventListener('change', e => {
  dwThickness = 2*Math.round(e.target.value/2) + 1;
  mats.ksize = new cv.Size(dwThickness, dwThickness);
});

function handleMouseMove(e) {
  if (clicked) {
    //Action-based
    actionDraw(e);
    //Image-based
    // draw(e)
  }
}

function handleMouseDown(e) {
  clicked = true;
  //Action-based
  let ratio = onScreenCVS.width / offScreenCVS.width;
  firstX = Math.floor(e.offsetX / ratio);
  firstY = Math.floor(e.offsetY / ratio);
  actionDraw(e);
}

function handleMouseUp() {
  clicked = false;
  //Action-based
  undoStack.push(points);
  points = [];
  //Reset redostack
  redoStack = [];
  renderBoth(true, true); // change to true, true when domain wall rendering is finished
}

//Action functions
function actionDraw(e) {
  let ratio = onScreenCVS.width / offScreenCVS.width;
  let mouseX = Math.floor(e.offsetX / ratio);
  let mouseY = Math.floor(e.offsetY / ratio);
  // draw
  offScreenCTX.lineWidth = lineWidth;
  offScreenCTX.lineCap = 'round';
  if (isDrawing === true) {
    offScreenCTX.strokeStyle = "black";
  } else if (isErasing ===true) {
    offScreenCTX.strokeStyle = "white";
  }
  offScreenCTX.beginPath();
  offScreenCTX.moveTo(firstX,firstY)
  offScreenCTX.lineTo(mouseX,mouseY);
  offScreenCTX.stroke();

  if (lastX !== mouseX || lastY !== mouseY) {
    points.push({
      x0: firstX,
      y0: firstY,
      x1: mouseX,
      y1: mouseY,
      size: lineWidth,
      type: isDrawing
    });
    source = offScreenCVS.toDataURL();
    renderImage();
  }

  //save last point
  lastX = mouseX;
  lastY = mouseY;
  firstX = lastX;
  firstY = lastY;
}

//====================================//
//======== * * * OpenCV * * * ========//
//====================================//

async function startOpenCV() {
  source = offScreenCVS.toDataURL();
  await waitFor(_ => cvloaded === true);
  mats.ksize = new cv.Size(dwThickness, dwThickness);
  mats.mz = new cv.Mat();
  mats.hierarchy = new cv.Mat();
  renderBoth(false, false);
  window.onresize = flexCanvasSize;
}

//====================================//
//==== * * * Magnetization * * * =====//
//====================================//

async function drawMagSource(blur) {
  let mz = await generateMz(blur);
  return imageDataToDataURL(matToImageData( mz ));
}

async function generateMz(blur) {
  await waitFor(_ => state.updatingDone === true)
  mats.cvsource = cv.imread(img);
  if (blur === true) {
    cv.GaussianBlur(mats.cvsource, mats.mz, mats.ksize, 0, 0, cv.BORDER_WRAP);
  } else if (blur === false) {
    mats.mz = mats.cvsource;
  }
  return mats.mz;
}

async function generatePreviewArrows(stride = 20) {
  let ratioX = offScreenCVS.width / onScreenCVS.width;
  let ratioY = offScreenCVS.height / onScreenCVS.height;
  await waitFor(_ => cvloaded === true);
  mats.contours = await findContours(mats.cvsource,cv.CHAIN_APPROX_NONE);
  console.log("Number of contours (excluding border): "+state.contour_number_noborder);
  for (var i = 1; i < mats.contours.size(); i++) {
    console.log("test", i)
    var xyAng = await dwAngleGenerator(mats.contours.get(i));
    console.log(xyAng.length);
    for (var j = 0; j < xyAng.length; j+=stride) {
      drawArrow(magCTX,xyAng[j][0]/ratioX,xyAng[j][1]/ratioY,stride/2,stride/4,xyAng[j][2]);
    }
  }
}

// use this line to convert cv.Mat to image
// imageSource = imageDataToDataURL(matToImageData( src ));