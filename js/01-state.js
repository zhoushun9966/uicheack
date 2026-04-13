'use strict';
// ====== STATE ======
let activeTool = null;
let annoProps = { color:'#ff6b35', lw:4, dashed:false, fontSize:72, bold:false, italic:false, underline:false };
let eraserSize = 60;
let annos = [], history = [], redoHistory = [];
let gridAnnos = [], gridHistory = [], gridRedoHistory = [];
function curAnnos() { return annos; }
let isMouseDown = false, startX = 0, startY = 0;
let brushPoints = [];
let selectedAnnoIdx = -1, activeHandle = null, isDraggingAnno = false, dragOffX = 0, dragOffY = 0;
let _shapeDragLb = null, _shapeDragStart = null;
let pendingTextCommit = null;
let suppressTextBlur = false;
// New mode state
let isActive = false;        // whether comparison is running
let currentMode = 'outline'; // 'compare' | 'outline' | 'findiff'
let sensitivityVal = 40;     // threshold for diff comparison
// Legacy derived vars (kept for compatibility with analysis functions)
let isComparing = false, isOutline = false, isFindiff = false, isVSplit = false;
function isGridActive(){ return false; } // grid view removed; annotations always use single canvas
let reportData = null, regionChecked = [], activeFilter = 'all';
let canvasScale = 1, annoCanvasScale = 1, zoomLevel = 0.7;
const ZOOM_BASE = 0.7; // 100% display reference zoom level
let bwMode = false, lang = 'zh';
let eraserType = 'e-mark';       // current eraser sub-type: 'e-mark' | 'e-ps'
let showMoreAnnotations = false;  // show circle/arrow/line shapes in prop panel
let aiConfig = { enabled:true, type:'ollama', url:'http://localhost:11434', model:'', apiKey:'',
  diagTypes:['位置偏移','功能缺失','颜色差异','文字差异','尺寸差异'], diagMaxIssues:5,
  diagContext:'', diagIgnore:[] };
let gameImg = null, psImg = null;
let markCtx, annoCtx, clickCtx, splitCtx;
let textAnnoX = 0, textAnnoY = 0;
let reportMarkers = [];
let panelCache = {};
let gridZoom = 1, gridPanX = 0, gridPanY = 0, gridIsPanning = false, gridPanStart = null;
let panX = 0, panY = 0; // viewport pan offset (px)
let mGenCanvas, mGenCtx;
let exportMerge = true; // true=合并导出, false=分开导出
// Canvas labels (draggable QA tags placed on viewport)
let canvasLabels = [];
let selectedLabelId = null; // currently selected label for editing
let pasteTarget = null; // which upload slot receives paste: 'game' or 'ps' or null
let labelProps = { color:'#007AFF', shape:'rect', lw:2, opacity:0.35 };
const CP_COLORS = ['#ffeb3b','#ff4757','#007AFF','#00b894','#ff6b35','#a29bfe','#ffffff','#000000'];
const AI_PROMPT = `你是一个专业的UI质量检测AI。请分析以下UI差异数据，给出简洁的中文诊断报告。重点指出：1.哪些区域问题最严重 2.可能的原因 3.修复建议。数据：`;
// QA tag definitions
const QA_TAGS = [
  {cat:'位置偏移',cls:'cat-layout',tags:['水平偏移','垂直偏移','整体偏移','间距偏差']},
  {cat:'尺寸差异',cls:'cat-size',tags:['元素偏大','元素偏小','宽度不符','高度不符']},
  {cat:'颜色差异',cls:'cat-color',tags:['颜色偏差','亮度不符','饱和度偏差','透明度差异']},
  {cat:'内容差异',cls:'cat-text',tags:['文字差异','内容缺失','多余内容','图片差异']},
  {cat:'样式差异',cls:'cat-asset',tags:['边框差异','圆角差异','阴影差异','背景差异']},
];

// ====== DOM REFS ======
const gameLayer = document.getElementById('game-layer');
const psLayer = document.getElementById('ps-layer');
const markCanvas = document.getElementById('mark-canvas');
const annoCanvas = document.getElementById('anno-canvas');
const clickCanvas = document.getElementById('click-canvas');
const splitCanvas = document.getElementById('split-canvas');
const layers = document.getElementById('layers');
const viewport = document.getElementById('viewport');
const emptyGuide = document.getElementById('empty-guide');
const propPanel = document.getElementById('prop-panel');
const propInner = document.getElementById('prop-inner');
const eraserCircle = document.getElementById('eraser-circle');
const canvasTooltip = document.getElementById('canvas-tooltip');
const zoomInfo = document.getElementById('zoom-text');
