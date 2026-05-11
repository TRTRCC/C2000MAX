'use strict';
'require view';
'require rpc';
'require poll';
'require dom';
'require ui';

var callGetStatus = rpc.declare({
	object: 'fanctrl',
	method: 'get_status'
});

var callGetConfig = rpc.declare({
	object: 'fanctrl',
	method: 'get_config'
});

var callSetMode = rpc.declare({
	object: 'fanctrl',
	method: 'set_mode',
	params: ['mode']
});

var callSetManualPwm = rpc.declare({
	object: 'fanctrl',
	method: 'set_manual_pwm',
	params: ['pwm']
});

var callSetCurve = rpc.declare({
	object: 'fanctrl',
	method: 'set_curve',
	params: ['mode', 'temps', 'speeds']
});

var callSetEnabled = rpc.declare({
	object: 'fanctrl',
	method: 'set_enabled',
	params: ['enabled']
});

var callSetFanSwitch = rpc.declare({
	object: 'fanctrl',
	method: 'set_fan_switch',
	params: ['enabled']
});

var MODE_COLORS = {
	silent:       '#4caf50',
	balanced:     '#2196f3',
	performance:  '#7c4dff',
	custom:       '#607d8b',
	manual:       '#ff9800',
	off:          '#9e9e9e'
};

var MODE_THEMES = {
	silent: {
		accent: '#4caf50',
		accentDark: '#2e7d32',
		accentSoft: '#e8f5e9',
		curveFill: 'rgba(76,175,80,0.10)',
		page: '#f4faf5',
		blade: '#eef8f0',
		bladeStroke: '#b7d9bd'
	},
	balanced: {
		accent: '#2196f3',
		accentDark: '#1565c0',
		accentSoft: '#e3f2fd',
		curveFill: 'rgba(33,150,243,0.10)',
		page: '#f3f8fd',
		blade: '#eef6fc',
		bladeStroke: '#b7d7ef'
	},
	performance: {
		accent: '#7c4dff',
		accentDark: '#512da8',
		accentSoft: '#eee8ff',
		curveFill: 'rgba(124,77,255,0.10)',
		page: '#f7f4ff',
		blade: '#f4f0ff',
		bladeStroke: '#c8b9ff'
	},
	custom: {
		accent: '#607d8b',
		accentDark: '#37474f',
		accentSoft: '#eceff1',
		curveFill: 'rgba(96,125,139,0.10)',
		page: '#f5f7f8',
		blade: '#f1f5f7',
		bladeStroke: '#bdcbd2'
	},
	manual: {
		accent: '#ff9800',
		accentDark: '#ef6c00',
		accentSoft: '#fff3e0',
		curveFill: 'rgba(255,152,0,0.10)',
		page: '#fff9f0',
		blade: '#fff5e7',
		bladeStroke: '#ffd39a'
	},
	off: {
		accent: '#9e9e9e',
		accentDark: '#616161',
		accentSoft: '#eeeeee',
		curveFill: 'rgba(158,158,158,0.10)',
		page: '#f6f6f6',
		blade: '#f1f1f1',
		bladeStroke: '#cfcfcf'
	}
};

var MODE_ICONS = {
	silent:       '\u2667',
	balanced:     '\u2696',
	performance:  '\u25F4',
	custom:       '\u2637'
};

var MODE_LABELS = {
	silent:       '静音模式',
	balanced:     '均衡模式',
	performance:  '性能模式',
	custom:       '自定义模式',
	manual:       '手动模式',
	off:          '关闭',
	disabled:     '已停用'
};

var MODE_DESCS = {
	silent:       '低噪运行，优先安静',
	balanced:     '噪声与温度自动平衡',
	performance:  '优先散热，响应更积极',
	custom:       '使用自定义温度-转速曲线'
};

var PRESET_LABELS = {
	silent:       '静音预设',
	balanced:     '均衡预设',
	performance:  '性能预设',
	custom:       '自定义预设'
};

function parseCurveArr(val) {
	if (!val) return [];
	var arr = [];
	if (Array.isArray(val)) arr = val.map(Number);
	else if (typeof val === 'string') arr = val.split(',').map(function(v) { return Number(v); });
	return arr.filter(function(v) { return isFinite(v); });
}

function getTheme(mode) {
	return MODE_THEMES[mode] || MODE_THEMES.balanced;
}

function buildFanSVG() {
	var blades = '';
	var ticks = '';
	for (var i = 0; i < 9; i++) {
		var angle = i * 40;
		blades += '<path d="M-7,-29 C-10,-44 -15,-60 -17,-73 C-18,-79 -14,-84 -7,-85 C0,-85 8,-82 13,-76 C14,-67 12,-55 9,-46 C7,-38 4,-32 2,-29 Z" fill="url(#fanBladeGrad)" stroke="var(--fan-blade-stroke)" stroke-width="0.7" stroke-linejoin="round" transform="rotate(' + angle + ')"/>' +
			'<path d="M-2,-33 C-5,-48 -9,-62 -11,-73" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.2" stroke-linecap="round" transform="rotate(' + angle + ')"/>';
	}
	for (var j = 0; j < 36; j++) {
		var major = j % 3 === 0;
		var r1 = 96;
		var r2 = major ? 87 : 91;
		var sw = major ? 1.6 : 0.7;
		var op = major ? 0.6 : 0.22;
		ticks += '<line x1="0" y1="-' + r1 + '" x2="0" y2="-' + r2 + '" stroke="var(--theme-accent)" stroke-opacity="' + op + '" stroke-width="' + sw + '" stroke-linecap="round" transform="rotate(' + (j * 10) + ')"/>';
	}
	return '<svg class="fan-svg" viewBox="-105 -105 210 210" xmlns="http://www.w3.org/2000/svg">' +
		'<defs>' +
		'<linearGradient id="fanBladeGrad" x1="0%" y1="10%" x2="90%" y2="100%">' +
		'<stop offset="0%" style="stop-color:#f5f7fa"/><stop offset="45%" style="stop-color:var(--fan-blade)"/><stop offset="100%" style="stop-color:var(--fan-blade-stroke)"/>' +
		'</linearGradient>' +
		'<radialGradient id="fanHubGrad" cx="38%" cy="35%" r="62%">' +
		'<stop offset="0%" style="stop-color:var(--theme-accent-soft)"/><stop offset="50%" style="stop-color:var(--theme-accent)"/><stop offset="100%" style="stop-color:var(--theme-accent-dark)"/>' +
		'</radialGradient>' +
		'<radialGradient id="fanBgGrad" cx="50%" cy="50%" r="50%">' +
		'<stop offset="0%" style="stop-color:#fefefe"/><stop offset="100%" style="stop-color:#edf1f5"/>' +
		'</radialGradient>' +
		'<filter id="hubGlow" x="-50%" y="-50%" width="200%" height="200%">' +
		'<feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
		'</filter>' +
		'<filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">' +
		'<feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
		'</filter>' +
		'</defs>' +
		'<circle cx="0" cy="0" r="102" fill="url(#fanBgGrad)" stroke="#d5dde5" stroke-width="1.2"/>' +
		'<g class="fan-ticks">' + ticks + '</g>' +
		'<circle cx="0" cy="0" r="93" fill="none" stroke="var(--theme-accent)" stroke-width="3.2" stroke-opacity="0.85" filter="url(#ringGlow)"/>' +
		'<circle cx="0" cy="0" r="84" fill="none" stroke="var(--fan-blade-stroke)" stroke-width="0.6" stroke-opacity="0.35"/>' +
		'<g class="fan-blades">' + blades + '</g>' +
		'<circle cx="0" cy="0" r="28" fill="#ffffff" stroke="var(--theme-accent)" stroke-width="2.5"/>' +
		'<circle cx="0" cy="0" r="20" fill="url(#fanHubGrad)" filter="url(#hubGlow)"/>' +
		'<ellipse cx="-5" cy="-6" rx="7" ry="5" fill="rgba(255,255,255,0.4)"/>' +
		'<circle cx="0" cy="0" r="5.5" fill="var(--theme-accent-dark)"/>' +
		'</svg>';
}

function drawCurveChart(canvas, points, currentTemp, theme) {
	var rect = canvas.getBoundingClientRect();
	var dpr = window.devicePixelRatio || 1;
	var w = rect.width || 310;
	var h = rect.height || 240;
	canvas.width = w * dpr;
	canvas.height = h * dpr;
	var ctx = canvas.getContext('2d');
	ctx.scale(dpr, dpr);

	var pad = { left: 44, right: 14, top: 14, bottom: 32 };
	var cw = w - pad.left - pad.right;
	var ch = h - pad.top - pad.bottom;
	var xMin = 20, xMax = 110;
	var yMin = 0, yMax = 100;

	function xToCanvas(temp) { return pad.left + (temp - xMin) / (xMax - xMin) * cw; }
	function yToCanvas(speed) { return pad.top + ch - (speed - yMin) / (yMax - yMin) * ch; }

	ctx.clearRect(0, 0, w, h);
	ctx.fillStyle = '#fafbfc';
	ctx.fillRect(0, 0, w, h);

	ctx.strokeStyle = '#eaeaea';
	ctx.lineWidth = 1;
	for (var temp = 20; temp <= 110; temp += 10) {
		ctx.beginPath(); ctx.moveTo(xToCanvas(temp), pad.top); ctx.lineTo(xToCanvas(temp), pad.top + ch); ctx.stroke();
	}
	for (var speed = 0; speed <= 100; speed += 20) {
		ctx.beginPath(); ctx.moveTo(pad.left, yToCanvas(speed)); ctx.lineTo(pad.left + cw, yToCanvas(speed)); ctx.stroke();
	}

	ctx.font = '10px -apple-system, sans-serif';
	ctx.fillStyle = '#999';
	ctx.textAlign = 'center';
	for (var t = 30; t <= 100; t += 10) ctx.fillText(t + '\u00B0C', xToCanvas(t), pad.top + ch + 16);
	ctx.textAlign = 'right';
	for (var s = 0; s <= 100; s += 20) ctx.fillText(s + '%', pad.left - 6, yToCanvas(s) + 4);

	ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1.5;
	ctx.beginPath(); ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, pad.top + ch); ctx.lineTo(pad.left + cw, pad.top + ch); ctx.stroke();

	if (!points || points.length < 2) {
		ctx.fillStyle = '#90a4ae';
		ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('未读取到 /etc/config/fanctrl 的控温策略', pad.left + cw / 2, pad.top + ch / 2 - 8);
		ctx.fillText('请检查 fanctrl.get_config 返回值', pad.left + cw / 2, pad.top + ch / 2 + 12);
		return { xToCanvas: xToCanvas, yToCanvas: yToCanvas, pad: pad, cw: cw, ch: ch, w: w, h: h, dpr: dpr, sortedPts: [] };
	}
	var sortedPts = points.slice().sort(function(a, b) { return a.temp - b.temp; });

	ctx.beginPath();
	ctx.moveTo(xToCanvas(sortedPts[0].temp), yToCanvas(0));
	for (var i = 0; i < sortedPts.length; i++) ctx.lineTo(xToCanvas(sortedPts[i].temp), yToCanvas(sortedPts[i].speed));
	ctx.lineTo(xToCanvas(sortedPts[sortedPts.length - 1].temp), yToCanvas(0));
	ctx.closePath();
	ctx.fillStyle = theme.curveFill || 'rgba(33,150,243,0.08)'; ctx.fill();

	ctx.beginPath();
	ctx.moveTo(xToCanvas(sortedPts[0].temp), yToCanvas(sortedPts[0].speed));
	for (var i = 1; i < sortedPts.length; i++) ctx.lineTo(xToCanvas(sortedPts[i].temp), yToCanvas(sortedPts[i].speed));
	ctx.strokeStyle = theme.accent; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();

	for (var i = 0; i < sortedPts.length; i++) {
		var cx = xToCanvas(sortedPts[i].temp), cy = yToCanvas(sortedPts[i].speed);
		ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
		ctx.strokeStyle = theme.accent; ctx.lineWidth = 2.5; ctx.stroke();
		ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fillStyle = theme.accent; ctx.fill();
	}

	if (currentTemp != null && currentTemp !== undefined) {
		var ct = Math.min(Math.max(currentTemp, xMin), xMax - 1);
		var interpSpeed = sortedPts[sortedPts.length - 1].speed;
		for (var i = 0; i < sortedPts.length - 1; i++) {
			if (ct >= sortedPts[i].temp && ct <= sortedPts[i + 1].temp) {
				var ratio = (ct - sortedPts[i].temp) / (sortedPts[i + 1].temp - sortedPts[i].temp || 1);
				interpSpeed = sortedPts[i].speed + ratio * (sortedPts[i + 1].speed - sortedPts[i].speed);
				break;
			} else if (ct < sortedPts[0].temp) { interpSpeed = sortedPts[0].speed; break; }
		}
		ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = '#f44336'; ctx.lineWidth = 1;
		ctx.beginPath(); ctx.moveTo(xToCanvas(ct), pad.top); ctx.lineTo(xToCanvas(ct), pad.top + ch); ctx.stroke(); ctx.restore();
		ctx.beginPath(); ctx.arc(xToCanvas(ct), yToCanvas(interpSpeed), 5, 0, Math.PI * 2);
		ctx.fillStyle = '#f44336'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
	}

	return { xToCanvas: xToCanvas, yToCanvas: yToCanvas, pad: pad, cw: cw, ch: ch, w: w, h: h, dpr: dpr, sortedPts: sortedPts };
}

var css = ''
	+ '.fanctrl-root { --theme-accent: #2196f3; --theme-accent-dark: #1565c0; --theme-accent-soft: #e3f2fd; --theme-page: #f3f8fd; --theme-soft-line: #d6eaf9; --fan-blade: #eef6fc; --fan-blade-stroke: #b7d7ef; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--theme-page); min-height: calc(100vh - 110px); padding: clamp(8px, 1vw, 14px); padding-bottom: 58px; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; transition: background 0.25s ease; }'
	+ '.fanctrl-page-title { margin: 0; color: var(--theme-accent-dark); font-size: clamp(22px, 2vh, 30px); line-height: 1.2; font-weight: 800; }'
	+ '.fanctrl-container { display: grid; grid-template-columns: minmax(250px, 0.84fr) minmax(380px, 1.18fr) minmax(330px, 1.04fr); gap: clamp(10px, 1.2vw, 18px); width: 100%; max-width: none; margin: 0; flex: 1; min-height: 0; align-items: stretch; }'
	+ '.fanctrl-left { min-height: 0; display: flex; flex-direction: column; gap: clamp(8px, 1vh, 14px); }'
	+ '.fanctrl-center { min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 12px; }'
	+ '.fanctrl-right { min-height: 0; display: flex; flex-direction: column; gap: 12px; }'
	+ '.fanctrl-card { background: #fff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); padding: clamp(10px, 1.15vh, 16px); }'
	+ '.fanctrl-right .fanctrl-card:last-child { flex: 1; display: flex; flex-direction: column; min-height: 0; }'
	+ '.mode-card { display: flex; align-items: center; padding: clamp(8px, 1vh, 13px) clamp(13px, 1vw, 18px); border-radius: 8px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.07); cursor: pointer; transition: all 0.2s; border: 2px solid transparent; gap: clamp(10px, 0.9vw, 16px); position: relative; flex: 0.72 1 0; min-height: 62px; }'
	+ '.mode-card:hover { box-shadow: 0 3px 10px rgba(0,0,0,0.12); transform: translateY(-1px); }'
	+ '.mode-card.active { background: var(--theme-accent-soft) !important; border-color: var(--theme-accent); }'
	+ '.mode-card.active .mode-check { display: flex; }'
	+ '.mode-icon { width: clamp(38px, 4.3vh, 52px); height: clamp(38px, 4.3vh, 52px); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: clamp(20px, 2.25vh, 27px); flex-shrink: 0; color: #fff; font-weight: 700; }'
	+ '.mode-info { flex: 1; min-width: 0; }'
	+ '.mode-name { font-weight: 600; font-size: clamp(14px, 1.28vh, 17px); color: #212121; margin-bottom: 2px; }'
	+ '.mode-desc { font-size: clamp(11px, 1vh, 13px); line-height: 1.28; color: #757575; white-space: normal; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }'
	+ '.mode-check { display: none; width: 22px; height: 22px; border-radius: 50%; background: var(--theme-accent); align-items: center; justify-content: center; flex-shrink: 0; }'
	+ '.mode-check svg { width: 14px; height: 14px; fill: #fff; }'
	+ '.manual-section { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); padding: clamp(16px, 1.75vh, 26px); margin-top: 0; flex: 1.85 1 0; min-height: 168px; display: flex; flex-direction: column; justify-content: center; }'
	+ '.manual-title { font-weight: 600; font-size: clamp(16px, 1.65vh, 20px); color: #212121; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }'
	+ '.manual-label { display: flex; justify-content: space-between; align-items: center; font-size: clamp(13px, 1.25vh, 15px); color: #757575; margin-bottom: 9px; }'
	+ '.manual-value { font-weight: 600; color: var(--theme-accent); font-size: clamp(15px, 1.6vh, 18px); }'
	+ '.pwm-slider { -webkit-appearance: none; width: 100%; height: 8px; border-radius: 4px; background: linear-gradient(to right, var(--theme-accent-soft), var(--theme-accent)); outline: none; margin: 12px 0; }'
	+ '.pwm-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 3px solid var(--theme-accent); cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }'
	+ '.pwm-slider::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 3px solid var(--theme-accent); cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }'
	+ '.btn-reset { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; background: #fafafa; color: #616161; font-size: clamp(12px, 1.15vh, 14px); cursor: pointer; transition: all 0.2s; margin-top: 12px; }'
	+ '.btn-reset:hover { background: #f0f0f0; border-color: #bbb; }'
	+ '.fan-title { font-size: clamp(19px, 1.9vh, 24px); font-weight: 700; color: #212121; margin: 0; text-align: center; }'
	+ '.fan-wrapper { position: relative; width: min(100%, 44vw, 50vh, 500px); height: min(100%, 44vw, 50vh, 500px); min-width: 310px; min-height: 310px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.08)); }'
	+ '.fan-svg { width: 100%; height: 100%; }'
	+ '.fan-blades { transform-box: fill-box; transform-origin: center; animation: fanSpin 2s linear infinite; transition: opacity 0.5s ease; }'
	+ '.fan-stopped .fan-blades { animation-play-state: paused; opacity: 0.65; }'
	+ '@keyframes fanSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'
	+ '.status-row { display: flex; gap: 10px; width: 100%; justify-content: center; margin-top: auto; }'
	+ '.status-card { flex: 1 1 0; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); padding: 10px 14px; text-align: center; min-width: 110px; }'
	+ '.status-card-label { font-size: clamp(12px, 1.05vh, 14px); color: #9e9e9e; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }'
	+ '.status-card-value { font-size: clamp(24px, 2.4vh, 30px); font-weight: 700; }'
	+ '.realtime-title { font-weight: 600; font-size: clamp(15px, 1.55vh, 18px); color: #212121; margin-bottom: 10px; }'
	+ '.realtime-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }'
	+ '.realtime-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 8px; background: #f8f9fa; font-size: clamp(12px, 1.1vh, 14px); }'
	+ '.realtime-item-label { color: #757575; }'
	+ '.realtime-item-value { font-weight: 600; color: #212121; }'
	+ '.curve-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }'
	+ '.curve-title { font-weight: 600; font-size: clamp(15px, 1.55vh, 18px); color: #212121; }'
	+ '.curve-header-right { display: flex; align-items: center; gap: 8px; }'
	+ '.curve-preset-select { padding: 5px 10px; border-radius: 6px; border: 1px solid #ddd; background: #fff; font-size: clamp(12px, 1.1vh, 14px); color: #424242; cursor: pointer; }'
	+ '.btn-reset-curve { background: none; border: 1px solid #ddd; border-radius: 6px; padding: 4px 10px; font-size: clamp(11px, 1vh, 13px); cursor: pointer; color: #757575; transition: all 0.2s; }'
	+ '.btn-reset-curve:hover { border-color: #bbb; background: #fafafa; }'
	+ '.curve-canvas-wrap { position: relative; background: #fafbfc; border-radius: 8px; border: 1px solid var(--theme-soft-line); overflow: hidden; min-height: clamp(260px, 36vh, 500px); flex: 1 1 auto; }'
	+ '.curve-canvas { display: block; width: 100%; height: 100%; min-height: clamp(260px, 36vh, 500px); cursor: default; }'
	+ '.btn-apply-curve { width: 100%; padding: 10px; border: none; border-radius: 8px; background: var(--theme-accent); color: #fff; font-size: clamp(14px, 1.35vh, 16px); font-weight: 600; cursor: pointer; transition: all 0.2s; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; }'
	+ '.btn-apply-curve:hover { background: var(--theme-accent-dark); }'
	+ '.btn-apply-curve:disabled { opacity: 0.72; cursor: default; }'
	+ '.fanctrl-bottom-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #e0e0e0; padding: 8px 20px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 -2px 8px rgba(0,0,0,0.06); z-index: 100; }'
	+ '.toggle-wrap { display: flex; align-items: center; gap: 10px; }'
	+ '.toggle-label { font-size: clamp(14px, 1.3vh, 16px); font-weight: 600; color: #424242; }'
	+ '.toggle-switch { position: relative; width: 48px; height: 26px; }'
	+ '.toggle-switch input { opacity: 0; width: 0; height: 0; }'
	+ '.toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; border-radius: 26px; transition: 0.3s; }'
	+ '.toggle-slider::before { content: ""; position: absolute; height: 20px; width: 20px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }'
	+ '.toggle-switch input:checked + .toggle-slider { background-color: var(--theme-accent); }'
	+ '.toggle-switch input:checked + .toggle-slider::before { transform: translateX(22px); }'
	+ '.bottom-actions { display: flex; align-items: center; gap: 14px; }'
	+ '.author-label { color: #607d8b; font-size: clamp(12px, 1.1vh, 14px); font-weight: 600; white-space: nowrap; }'
	+ '.switch-inline { display: inline-flex; align-items: center; justify-content: flex-end; gap: 8px; }'
	+ '@media (max-width: 1100px) { .fanctrl-root { min-height: auto; } .fanctrl-container { grid-template-columns: 1fr; } .fanctrl-left { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); } .mode-card { min-height: 86px; } .manual-section { min-height: 140px; } .fanctrl-center { min-height: 480px; } .fan-wrapper { width: min(76vw, 430px); height: min(76vw, 430px); } }'
	+ '@media (max-width: 640px) { .fanctrl-root { padding: 10px; padding-bottom: 86px; } .fanctrl-left { grid-template-columns: 1fr; } .status-row { flex-direction: column; align-items: stretch; } .realtime-grid { grid-template-columns: 1fr; } .fan-wrapper { width: 82vw; height: 82vw; min-width: 0; min-height: 0; } .fanctrl-bottom-bar { padding: 10px 12px; } .bottom-actions { gap: 8px; } .author-label { font-size: 11px; } }';

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callGetStatus(), {}),
			L.resolveDefault(callGetConfig(), {})
		]);
	},

	render: function(data) {
		var status = data[0] || {};
		var config = data[1] || {};
		var currentMode = config.mode || status.mode || 'balanced';
		var currentPwmPct = status.pwm_pct || 0;
		var enabled = (String(config.enabled != null ? config.enabled : '1') === '1');
		var curvePreset = (['silent', 'balanced', 'performance', 'custom'].indexOf(currentMode) >= 0) ? currentMode : 'balanced';

		var strategyCurves = {
			silent: { temps: parseCurveArr(config.curves && config.curves.silent ? config.curves.silent.temps : ''), speeds: parseCurveArr(config.curves && config.curves.silent ? config.curves.silent.speeds : '') },
			balanced: { temps: parseCurveArr(config.curves && config.curves.balanced ? config.curves.balanced.temps : ''), speeds: parseCurveArr(config.curves && config.curves.balanced ? config.curves.balanced.speeds : '') },
			performance: { temps: parseCurveArr(config.curves && config.curves.performance ? config.curves.performance.temps : ''), speeds: parseCurveArr(config.curves && config.curves.performance ? config.curves.performance.speeds : '') },
			custom: { temps: parseCurveArr(config.curves && config.curves.custom ? config.curves.custom.temps : ''), speeds: parseCurveArr(config.curves && config.curves.custom ? config.curves.custom.speeds : '') }
		};
		var loadedCurves = JSON.parse(JSON.stringify(strategyCurves));

		function getCurvePoints(preset) {
			var c = strategyCurves[preset] || strategyCurves.balanced || { temps: [], speeds: [] };
			var pts = [];
			for (var i = 0; i < Math.min(c.temps.length, c.speeds.length); i++) {
				pts.push({ temp: c.temps[i], speed: c.speeds[i] });
			}
			return pts;
		}

		// Inject CSS
		var styleEl = document.createElement('style');
		styleEl.type = 'text/css';
		styleEl.textContent = css;
		document.head.appendChild(styleEl);

		// Root container
		var root = document.createElement('div');
		root.className = 'fanctrl-root';
		var activeTheme = getTheme(currentMode);

		function applyTheme(mode) {
			activeTheme = getTheme(mode);
			root.style.setProperty('--theme-accent', activeTheme.accent);
			root.style.setProperty('--theme-accent-dark', activeTheme.accentDark);
			root.style.setProperty('--theme-accent-soft', activeTheme.accentSoft);
			root.style.setProperty('--theme-page', activeTheme.page);
			root.style.setProperty('--theme-soft-line', activeTheme.softLine || activeTheme.accentSoft);
			root.style.setProperty('--fan-blade', activeTheme.blade);
			root.style.setProperty('--fan-blade-stroke', activeTheme.bladeStroke);
		}
		applyTheme(currentMode);

		var pageTitle = document.createElement('h1');
		pageTitle.className = 'fanctrl-page-title';
		pageTitle.textContent = _('风扇控制面板');
		root.appendChild(pageTitle);

		// ====== LEFT COLUMN ======
		var leftCol = document.createElement('div');
		leftCol.className = 'fanctrl-left';

		var modes = ['silent', 'balanced', 'performance', 'custom'];
		var modeCards = {};

		modes.forEach(function(mode) {
			var card = document.createElement('div');
			card.className = 'mode-card' + (currentMode === mode ? ' active' : '');
			card.setAttribute('data-mode', mode);

			var iconDiv = document.createElement('div');
			iconDiv.className = 'mode-icon';
			iconDiv.style.background = MODE_COLORS[mode];
			iconDiv.textContent = MODE_ICONS[mode];

			var infoDiv = document.createElement('div');
			infoDiv.className = 'mode-info';
			var nameDiv = document.createElement('div');
			nameDiv.className = 'mode-name';
			nameDiv.textContent = _(MODE_LABELS[mode]);
			var descDiv = document.createElement('div');
			descDiv.className = 'mode-desc';
			descDiv.textContent = _(MODE_DESCS[mode]);
			infoDiv.appendChild(nameDiv);
			infoDiv.appendChild(descDiv);

			var checkDiv = document.createElement('div');
			checkDiv.className = 'mode-check';
			checkDiv.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';

			card.appendChild(iconDiv);
			card.appendChild(infoDiv);
			card.appendChild(checkDiv);
			modeCards[mode] = card;
			leftCol.appendChild(card);
		});

		// Manual control section
		var manualPwmVal = (currentMode === 'manual') ? (currentPwmPct || 50) : 50;
		var manualSection = document.createElement('div');
		manualSection.className = 'manual-section';

		var manualTitle = document.createElement('div');
		manualTitle.className = 'manual-title';
		manualTitle.textContent = '\u2637 ' + _('手动控制');

		var manualLabel = document.createElement('div');
		manualLabel.className = 'manual-label';
		var manualLabelSpan = document.createElement('span');
		manualLabelSpan.textContent = _('风扇占空比');
		var manualValueSpan = document.createElement('span');
		manualValueSpan.className = 'manual-value pwm-val-display';
		manualValueSpan.textContent = manualPwmVal + '%';
		manualLabel.appendChild(manualLabelSpan);
		manualLabel.appendChild(manualValueSpan);

		var pwmSlider = document.createElement('input');
		pwmSlider.type = 'range';
		pwmSlider.min = '0';
		pwmSlider.max = '100';
		pwmSlider.value = String(manualPwmVal);
		pwmSlider.className = 'pwm-slider';

		var btnResetPwm = document.createElement('button');
		btnResetPwm.className = 'btn-reset';
		btnResetPwm.textContent = '\u21BA ' + _('恢复默认设置');

		manualSection.appendChild(manualTitle);
		manualSection.appendChild(manualLabel);
		manualSection.appendChild(pwmSlider);
		manualSection.appendChild(btnResetPwm);
		leftCol.appendChild(manualSection);

		pwmSlider.addEventListener('input', function() {
			manualValueSpan.textContent = this.value + '%';
		});
		pwmSlider.addEventListener('change', function() {
			var pct = parseInt(this.value, 10);
			var raw = Math.round(pct * 255 / 100);
			callSetMode('manual');
			callSetManualPwm(raw);
			setActiveMode('manual');
		});
		btnResetPwm.addEventListener('click', function() {
			pwmSlider.value = '50';
			manualValueSpan.textContent = '50%';
			callSetMode('manual');
			callSetManualPwm(Math.round(50 * 255 / 100));
			setActiveMode('manual');
		});

		// ====== CENTER COLUMN ======
		var centerCol = document.createElement('div');
		centerCol.className = 'fanctrl-center';

		var fanTitle = document.createElement('h2');
		fanTitle.className = 'fan-title';
		fanTitle.textContent = _('CPU 风扇');
		fanTitle.style.color = MODE_COLORS[currentMode] || '#212121';
		centerCol.appendChild(fanTitle);

		var fanWrapper = document.createElement('div');
		fanWrapper.className = 'fan-wrapper';
		fanWrapper.innerHTML = buildFanSVG();
		centerCol.appendChild(fanWrapper);

		var fanBlades = fanWrapper.querySelector('.fan-blades');
		if (fanBlades) {
			if (currentPwmPct === 0) {
				fanBlades.style.animationPlayState = 'paused';
				fanWrapper.classList.add('fan-stopped');
			} else {
				fanBlades.style.animationPlayState = 'running';
				fanBlades.style.animationDuration = Math.max(0.35, 3.2 - currentPwmPct * 0.028) + 's';
				fanWrapper.classList.remove('fan-stopped');
			}
		}

		// Status cards row
		var statusRow = document.createElement('div');
		statusRow.className = 'status-row';

		var cpuTempCard = document.createElement('div');
		cpuTempCard.className = 'status-card';
		var cpuTempLabel = document.createElement('div');
		cpuTempLabel.className = 'status-card-label';
		cpuTempLabel.textContent = _('CPU 温度');
		var cpuTempValue = document.createElement('div');
		cpuTempValue.className = 'status-card-value';
		cpuTempValue.style.color = '#00bcd4';
		cpuTempValue.textContent = (status.cpu_temp != null ? status.cpu_temp : '--') + '\u00B0C';
		cpuTempCard.appendChild(cpuTempLabel);
		cpuTempCard.appendChild(cpuTempValue);

		var fanDutyCard = document.createElement('div');
		fanDutyCard.className = 'status-card';
		var fanDutyLabel = document.createElement('div');
		fanDutyLabel.className = 'status-card-label';
		fanDutyLabel.textContent = _('风扇占空比');
		var fanDutyValue = document.createElement('div');
		fanDutyValue.className = 'status-card-value';
		fanDutyValue.style.color = MODE_COLORS[currentMode] || '#2196f3';
		fanDutyValue.textContent = (currentPwmPct != null ? currentPwmPct : '--') + '%';
		fanDutyCard.appendChild(fanDutyLabel);
		fanDutyCard.appendChild(fanDutyValue);

		var currentModeCard = document.createElement('div');
		currentModeCard.className = 'status-card';
		var currentModeLabel = document.createElement('div');
		currentModeLabel.className = 'status-card-label';
		currentModeLabel.textContent = _('当前模式');
		var currentModeValue = document.createElement('div');
		currentModeValue.className = 'status-card-value';
		currentModeValue.style.color = MODE_COLORS[currentMode] || '#424242';
		currentModeValue.textContent = _(MODE_LABELS[currentMode] || currentMode);
		currentModeCard.appendChild(currentModeLabel);
		currentModeCard.appendChild(currentModeValue);

		statusRow.appendChild(cpuTempCard);
		statusRow.appendChild(fanDutyCard);
		statusRow.appendChild(currentModeCard);
		centerCol.appendChild(statusRow);

		// ====== RIGHT COLUMN ======
		var rightCol = document.createElement('div');
		rightCol.className = 'fanctrl-right';

		// Realtime status section
		var rtSection = document.createElement('div');
		rtSection.className = 'fanctrl-card';
		var rtTitle = document.createElement('div');
		rtTitle.className = 'realtime-title';
		rtTitle.textContent = '\u25F4 ' + _('实时状态');
		rtSection.appendChild(rtTitle);

		var rtGrid = document.createElement('div');
		rtGrid.className = 'realtime-grid';
		var fanSwitchButton = document.createElement('button');
		fanSwitchButton.type = 'button';
		fanSwitchButton.className = 'btn-reset';
		fanSwitchButton.style.width = 'auto';
		fanSwitchButton.style.minWidth = '92px';
		fanSwitchButton.style.marginTop = '0';

		var rtItems = [
			{ key: 'cpu_temp',      label: _('CPU 温度'),      unit: '\u00B0C', color: '#00bcd4' },
			{ key: 'pwm_pct',       label: _('CPU 风扇占空比'), unit: '%',       color: '#2196f3' },
			{ key: 'wifi_temp_2g',  label: _('WiFi 2.4G'),     unit: '\u00B0C', color: '#ff9800' },
			{ key: 'wifi_temp_5g',  label: _('WiFi 5G'),       unit: '\u00B0C', color: '#ff5722' },
			{ key: 'modem_5g_temp', label: _('5G 模组'),        unit: '\u00B0C', color: '#9c27b0' },
			{ key: 'gpio',          label: _('风扇开关'),       unit: '',        color: '#607d8b', switch: true }
		];

		var rtElements = {};
		rtItems.forEach(function(item) {
			var val = status[item.key] != null ? status[item.key] : '--';
			var el = document.createElement('div');
			el.className = 'realtime-item';
			var labelSpan = document.createElement('span');
			labelSpan.className = 'realtime-item-label';
			labelSpan.textContent = item.label;
			var valueSpan = document.createElement('span');
			valueSpan.className = 'realtime-item-value';
			valueSpan.style.color = item.color;
			if (item.switch) {
				var switchWrap = document.createElement('div');
				switchWrap.className = 'switch-inline';
				fanSwitchButton.textContent = (val === 1 || val === '1') ? _('开启') : _('关闭');
				fanSwitchButton.style.background = (val === 1 || val === '1') ? 'var(--theme-accent-soft)' : '#f4f4f4';
				fanSwitchButton.style.color = (val === 1 || val === '1') ? 'var(--theme-accent-dark)' : '#607d8b';
				switchWrap.appendChild(fanSwitchButton);
				valueSpan.appendChild(switchWrap);
			} else {
				valueSpan.textContent = val + item.unit;
			}
			el.appendChild(labelSpan);
			el.appendChild(valueSpan);
			rtElements[item.key] = valueSpan;
			rtGrid.appendChild(el);
		});
		rtSection.appendChild(rtGrid);
		rightCol.appendChild(rtSection);

		// Curve section
		var curveSection = document.createElement('div');
		curveSection.className = 'fanctrl-card';

		var curveHeader = document.createElement('div');
		curveHeader.className = 'curve-header-row';
		var curveTitle = document.createElement('div');
		curveTitle.className = 'curve-title';
		curveTitle.textContent = '\u25F1 ' + _('温度-转速曲线');
		curveHeader.appendChild(curveTitle);

		var curveHeaderRight = document.createElement('div');
		curveHeaderRight.className = 'curve-header-right';
		var presetSelect = document.createElement('select');
		presetSelect.className = 'curve-preset-select';
		['silent', 'balanced', 'performance', 'custom'].forEach(function(m) {
			var opt = document.createElement('option');
			opt.value = m;
			opt.textContent = _(PRESET_LABELS[m]);
			if (m === curvePreset) opt.selected = true;
			presetSelect.appendChild(opt);
		});
		curveHeaderRight.appendChild(presetSelect);
		var btnResetCurve = document.createElement('button');
		btnResetCurve.className = 'btn-reset-curve';
		btnResetCurve.textContent = '\u21BA ' + _('复位');
		curveHeaderRight.appendChild(btnResetCurve);
		curveHeader.appendChild(curveHeaderRight);
		curveSection.appendChild(curveHeader);

		var canvasWrap = document.createElement('div');
		canvasWrap.className = 'curve-canvas-wrap';
		var canvas = document.createElement('canvas');
		canvas.className = 'curve-canvas';
		canvas.style.width = '100%';
		canvas.style.height = '100%';
		canvasWrap.appendChild(canvas);
		curveSection.appendChild(canvasWrap);

		var btnApplyCurve = document.createElement('button');
		btnApplyCurve.className = 'btn-apply-curve';
		btnApplyCurve.textContent = '\u2714 ' + _('保存当前曲线');
		curveSection.appendChild(btnApplyCurve);
		rightCol.appendChild(curveSection);

		// ====== ASSEMBLE CONTAINER ======
		var container = document.createElement('div');
		container.className = 'fanctrl-container';
		container.appendChild(leftCol);
		container.appendChild(centerCol);
		container.appendChild(rightCol);
		root.appendChild(container);

		// ====== BOTTOM BAR ======
		var bottomBar = document.createElement('div');
		bottomBar.className = 'fanctrl-bottom-bar';
		var toggleWrap = document.createElement('div');
		toggleWrap.className = 'toggle-wrap';
		var toggleLabel = document.createElement('label');
		toggleLabel.className = 'toggle-switch';
		var toggleCheckbox = document.createElement('input');
		toggleCheckbox.type = 'checkbox';
		if (enabled) toggleCheckbox.checked = true;
		var toggleSlider = document.createElement('span');
		toggleSlider.className = 'toggle-slider';
		toggleLabel.appendChild(toggleCheckbox);
		toggleLabel.appendChild(toggleSlider);
		var toggleText = document.createElement('span');
		toggleText.className = 'toggle-label';
		toggleText.textContent = _('启用风扇控制');
		toggleWrap.appendChild(toggleLabel);
		toggleWrap.appendChild(toggleText);

		var bottomActions = document.createElement('div');
		bottomActions.className = 'bottom-actions';
		var authorLabel = document.createElement('span');
		authorLabel.className = 'author-label';
		authorLabel.textContent = _('作者：搞点薯条0007');

		bottomActions.appendChild(authorLabel);
		bottomBar.appendChild(toggleWrap);
		bottomBar.appendChild(bottomActions);
		root.appendChild(bottomBar);

		// ====== HELPER FUNCTIONS ======
		function setActiveMode(mode) {
			currentMode = mode;
			applyTheme(mode);
			modes.forEach(function(m) {
				if (m === mode) modeCards[m].classList.add('active');
				else modeCards[m].classList.remove('active');
			});
			currentModeValue.style.color = activeTheme.accentDark;
			currentModeValue.textContent = _(MODE_LABELS[mode] || mode);
			fanTitle.style.color = activeTheme.accentDark;
			cpuTempValue.style.color = activeTheme.accent;
			fanDutyValue.style.color = activeTheme.accent;
			manualValueSpan.style.color = activeTheme.accent;
			pageTitle.style.color = activeTheme.accentDark;
			redrawChart();
		}

		function updateFan(pwmPct) {
			pwmPct = Math.max(0, Math.min(100, Number(pwmPct) || 0));
			var fb = fanWrapper.querySelector('.fan-blades');
			if (fb) {
				if (pwmPct === 0) {
					fb.style.animationPlayState = 'paused';
					fanWrapper.classList.add('fan-stopped');
				} else {
					fb.style.animationPlayState = 'running';
					fb.style.animationDuration = Math.max(0.35, 3.2 - pwmPct * 0.028) + 's';
					fanWrapper.classList.remove('fan-stopped');
				}
			}
		}

		function updateFanSwitchButton(gpioVal, mode) {
			var on = (gpioVal === 1 || gpioVal === '1') && mode !== 'off';
			fanSwitchButton.textContent = on ? _('开启') : _('关闭');
			fanSwitchButton.style.background = on ? 'var(--theme-accent-soft)' : '#f4f4f4';
			fanSwitchButton.style.color = on ? 'var(--theme-accent-dark)' : '#607d8b';
			fanSwitchButton.setAttribute('data-on', on ? '1' : '0');
		}

		function saveCurveForMode(mode) {
			if (modes.indexOf(mode) < 0) return Promise.resolve();
			var pts = getCurvePoints(mode);
			if (!pts || pts.length < 2) return Promise.reject(new Error(_('未读取到该模式的控温曲线')));
			var temps = pts.map(function(p) { return p.temp; }).join(',');
			var speeds = pts.map(function(p) { return p.speed; }).join(',');
			return callSetCurve(mode, temps, speeds).then(function() {
				loadedCurves[mode] = JSON.parse(JSON.stringify(strategyCurves[mode]));
			});
		}

		function applyModeWithCurve(mode) {
			return saveCurveForMode(mode).then(function() {
				return callSetMode(mode);
			});
		}
		setActiveMode(currentMode);
		updateFanSwitchButton(status.gpio, currentMode);

		// ====== EVENT HANDLERS ======
		modes.forEach(function(mode) {
			modeCards[mode].addEventListener('click', function() {
				var previousMode = currentMode;
				setActiveMode(mode);
				if (['silent', 'balanced', 'performance', 'custom'].indexOf(mode) >= 0) {
					presetSelect.value = mode;
					curvePreset = mode;
					redrawChart();
				}
				applyModeWithCurve(mode).catch(function(err) {
					setActiveMode(previousMode);
					if (['silent', 'balanced', 'performance', 'custom'].indexOf(previousMode) >= 0) {
						presetSelect.value = previousMode;
						curvePreset = previousMode;
						redrawChart();
					}
					var msg = document.createElement('p');
					msg.textContent = _('切换模式失败：') + (err.message || err);
					ui.addNotification(null, msg, 'error');
				});
			});
		});

		toggleCheckbox.addEventListener('change', function() {
			enabled = this.checked;
			callSetEnabled(enabled ? '1' : '0').catch(function(err) {
				enabled = !enabled;
				toggleCheckbox.checked = enabled;
				var msg = document.createElement('p');
				msg.textContent = _('切换风扇控制失败：') + (err.message || err);
				ui.addNotification(null, msg, 'error');
			});
		});

		fanSwitchButton.addEventListener('click', function() {
			var nextOn = fanSwitchButton.getAttribute('data-on') !== '1';
			fanSwitchButton.disabled = true;
			callSetFanSwitch(nextOn ? '1' : '0').then(function(res) {
				if (res && res.mode) {
					setActiveMode(res.mode);
				} else if (nextOn && currentMode === 'off') {
					setActiveMode('balanced');
				} else if (!nextOn) {
					setActiveMode('off');
				}
				updateFanSwitchButton(nextOn ? 1 : 0, nextOn ? currentMode : 'off');
			}, function(err) {
				var msg = document.createElement('p');
				msg.textContent = _('切换风扇开关失败：') + (err.message || err);
				ui.addNotification(null, msg, 'error');
			}).then(function() {
				fanSwitchButton.disabled = false;
			});
		});

		// ====== CURVE CHART ======
		var chartState = null;
		var draggingNodeIdx = -1;
		var resizeTimer = null;

		function redrawChart() {
			var points = getCurvePoints(curvePreset);
			chartState = drawCurveChart(canvas, points, status.cpu_temp, getTheme(curvePreset || currentMode));
		}

		function scheduleRedraw() {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(redrawChart, 80);
		}

		requestAnimationFrame(function() { redrawChart(); });
		window.setTimeout(redrawChart, 120);
		window.addEventListener('resize', scheduleRedraw);
		if (window.ResizeObserver) {
			var curveResizeObserver = new ResizeObserver(scheduleRedraw);
			curveResizeObserver.observe(canvasWrap);
		}

		presetSelect.addEventListener('change', function() {
			curvePreset = this.value;
			redrawChart();
		});

		btnResetCurve.addEventListener('click', function() {
			var orig = loadedCurves[curvePreset];
			if (orig) strategyCurves[curvePreset] = JSON.parse(JSON.stringify(orig));
			redrawChart();
		});

		btnApplyCurve.addEventListener('click', function() {
			var defaultLabel = '\u2714 ' + _('保存当前曲线');
			var pts = getCurvePoints(curvePreset);
			var temps = pts.map(function(p) { return p.temp; }).join(',');
			var speeds = pts.map(function(p) { return p.speed; }).join(',');
			btnApplyCurve.disabled = true;
			btnApplyCurve.textContent = _('应用中...');
			callSetCurve(curvePreset, temps, speeds).then(function() {
				loadedCurves[curvePreset] = JSON.parse(JSON.stringify(strategyCurves[curvePreset]));
				btnApplyCurve.textContent = _('已应用');
			}, function(err) {
				btnApplyCurve.textContent = _('应用失败');
				if (window.console && console.warn) console.warn('fanctrl set_curve failed:', err);
			}).then(function() {
				window.setTimeout(function() {
					btnApplyCurve.disabled = false;
					btnApplyCurve.textContent = defaultLabel;
				}, 1200);
			});
		});

		// Canvas drag handling
		function getCanvasPoint(e) {
			var rect = canvas.getBoundingClientRect();
			var clientX, clientY;
			if (e.touches && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
			else { clientX = e.clientX; clientY = e.clientY; }
			return { x: clientX - rect.left, y: clientY - rect.top };
		}

		function canvasPointToData(px, py) {
			if (!chartState) return null;
			var s = chartState;
			var temp = (px - s.pad.left) / s.cw * (110 - 20) + 20;
			var speed = (1 - (py - s.pad.top) / s.ch) * 100;
			return { temp: Math.round(Math.min(110, Math.max(20, temp))), speed: Math.round(Math.min(100, Math.max(0, speed))) };
		}

		canvas.addEventListener('mousedown', function(e) {
			if (!chartState || !chartState.sortedPts || !chartState.sortedPts.length) return;
			e.preventDefault();
			var pt = getCanvasPoint(e);
			var sortedPts = chartState.sortedPts;
			var hitR2 = 14 * 14;
			draggingNodeIdx = -1;
			for (var i = 0; i < sortedPts.length; i++) {
				var dx = pt.x - chartState.xToCanvas(sortedPts[i].temp);
				var dy = pt.y - chartState.yToCanvas(sortedPts[i].speed);
				if (dx * dx + dy * dy < hitR2) { draggingNodeIdx = i; canvas.style.cursor = 'grabbing'; return; }
			}
		});

		canvas.addEventListener('mousemove', function(e) {
			if (draggingNodeIdx < 0 || !chartState || !chartState.sortedPts) return;
			e.preventDefault();
			var pt = getCanvasPoint(e);
			var data = canvasPointToData(pt.x, pt.y);
			if (!data) return;
			var origTemp = chartState.sortedPts[draggingNodeIdx].temp;
			var pts = getCurvePoints(curvePreset);
			for (var i = 0; i < pts.length; i++) {
				if (pts[i].temp === origTemp) { pts[i].speed = data.speed; break; }
			}
			strategyCurves[curvePreset].speeds = pts.map(function(p) { return p.speed; });
			redrawChart();
		});

		function stopDrag() {
			if (draggingNodeIdx >= 0) { draggingNodeIdx = -1; canvas.style.cursor = 'default'; }
		}

		canvas.addEventListener('mouseup', stopDrag);
		canvas.addEventListener('mouseleave', stopDrag);

		canvas.addEventListener('touchstart', function(e) {
			if (!chartState || !chartState.sortedPts || !chartState.sortedPts.length) return;
			e.preventDefault();
			var pt = getCanvasPoint(e);
			var sortedPts = chartState.sortedPts;
			var hitR2 = 20 * 20;
			draggingNodeIdx = -1;
			for (var i = 0; i < sortedPts.length; i++) {
				var dx = pt.x - chartState.xToCanvas(sortedPts[i].temp);
				var dy = pt.y - chartState.yToCanvas(sortedPts[i].speed);
				if (dx * dx + dy * dy < hitR2) { draggingNodeIdx = i; return; }
			}
		}, { passive: false });

		canvas.addEventListener('touchmove', function(e) {
			if (draggingNodeIdx < 0 || !chartState || !chartState.sortedPts) return;
			e.preventDefault();
			var pt = getCanvasPoint(e);
			var data = canvasPointToData(pt.x, pt.y);
			if (!data) return;
			var origTemp = chartState.sortedPts[draggingNodeIdx].temp;
			var pts = getCurvePoints(curvePreset);
			for (var i = 0; i < pts.length; i++) {
				if (pts[i].temp === origTemp) { pts[i].speed = data.speed; break; }
			}
			strategyCurves[curvePreset].speeds = pts.map(function(p) { return p.speed; });
			redrawChart();
		}, { passive: false });

		canvas.addEventListener('touchend', stopDrag);

		// ====== POLLING ======
		poll.add(function() {
			return callGetStatus().then(function(s) {
				if (!s) return;
				status = s;
				var pwm = s.pwm_pct || 0;
				currentPwmPct = pwm;
				updateFan(pwm);
				cpuTempValue.textContent = (s.cpu_temp != null ? s.cpu_temp : '--') + '\u00B0C';
				fanDutyValue.textContent = (pwm != null ? pwm : '--') + '%';
				if (s.enabled != null) {
					enabled = (String(s.enabled) === '1');
					toggleCheckbox.checked = enabled;
				}
				if (s.mode) setActiveMode(s.mode);
				rtItems.forEach(function(item) {
					var val = s[item.key] != null ? s[item.key] : '--';
					if (item.switch) updateFanSwitchButton(val, s.mode || currentMode);
					else rtElements[item.key].textContent = val + item.unit;
				});
				redrawChart();
			});
		}, 5);

		return root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
