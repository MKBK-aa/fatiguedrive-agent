const API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

const form = document.getElementById("analysisForm");
const apiKeyInput = document.getElementById("apiKey");
const modelNameInput = document.getElementById("modelName");
const customModelInput = document.getElementById("customModel");
const imageInput = document.getElementById("imageInput");
const dropZone = document.getElementById("dropZone");
const sceneContextInput = document.getElementById("sceneContext");
const analyzeBtn = document.getElementById("analyzeBtn");
const exampleBtn = document.getElementById("exampleBtn");
const resetBtn = document.getElementById("resetBtn");
const copyBtn = document.getElementById("copyBtn");
const loading = document.getElementById("loading");
const errorBox = document.getElementById("errorBox");
const previewArea = document.querySelector(".preview-area");
const imagePreview = document.getElementById("imagePreview");
const reportEmpty = document.getElementById("reportEmpty");
const report = document.getElementById("report");
const fatigueLevel = document.getElementById("fatigueLevel");
const confidenceText = document.getElementById("confidenceText");
const riskScore = document.getElementById("riskScore");
const scoreRing = document.getElementById("scoreRing");
const meterFill = document.getElementById("meterFill");
const featureGrid = document.getElementById("featureGrid");
const reasonList = document.getElementById("reasonList");
const suggestionList = document.getElementById("suggestionList");
const limitationsText = document.getElementById("limitationsText");
const rawResponse = document.getElementById("rawResponse");
const rawText = document.getElementById("rawText");

let imageDataUrl = "";
let lastReportText = "";

const SYSTEM_PROMPT = `你是 FatigueDrive-Agent，一个面向驾驶安全辅助的疲劳驾驶识别智能体。
你的任务是基于用户上传的驾驶员图像，观察可见视觉线索，并结合给定驾驶场景，输出结构化疲劳风险报告。
重要限制：
1. 只做驾驶安全辅助判断，不做医学诊断、身份识别或法律定责；
2. 如果画面看不清、没有驾驶员、面部被遮挡，要明确说明无法可靠判断；
3. 不要臆测图片中看不到的信息；
4. 必须综合眼睛状态、嘴部/打哈欠、头部姿态、表情疲劳感、身体坐姿；
5. 请只输出 JSON，不要使用 Markdown 代码块。
JSON 格式如下：
{
  "fatigue_level": "正常|轻度疲劳|中度疲劳|高风险|无法判断",
  "score": 0,
  "confidence": "高|中|低",
  "features": {
    "eyes": "眼睛状态观察",
    "mouth": "嘴部或打哈欠观察",
    "head_pose": "头部姿态观察",
    "facial_expression": "表情疲劳感观察",
    "body_posture": "身体坐姿观察"
  },
  "risk_reasons": ["判断依据1", "判断依据2"],
  "safety_suggestions": ["建议1", "建议2"],
  "limitations": "本次判断的限制"
}`;

const fallbackReport = {
  fatigue_level: "无法判断",
  score: 0,
  confidence: "低",
  features: {
    eyes: "模型回复未能解析为结构化结果。",
    mouth: "模型回复未能解析为结构化结果。",
    head_pose: "模型回复未能解析为结构化结果。",
    facial_expression: "模型回复未能解析为结构化结果。",
    body_posture: "模型回复未能解析为结构化结果。"
  },
  risk_reasons: ["请查看模型原始回复，或调整提示词后重新分析。"],
  safety_suggestions: ["更换清晰图片后重新尝试。"],
  limitations: "当前结果来自解析失败后的兜底展示。"
};

modelNameInput.addEventListener("change", () => {
  customModelInput.classList.toggle("hidden", modelNameInput.value !== "custom");
});

imageInput.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (file) {
    loadImageFile(file);
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragover");
  });
});

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) {
    loadImageFile(file);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await analyzeImage();
});

exampleBtn.addEventListener("click", () => {
  sceneContextInput.value = "夜间长途驾驶场景，驾驶员已经连续驾驶 3 小时以上。请重点关注闭眼、眯眼、打哈欠、低头、偏头和坐姿异常等疲劳风险线索。";
});

resetBtn.addEventListener("click", resetAll);
copyBtn.addEventListener("click", copyReport);

function loadImageFile(file) {
  clearError();

  if (!file.type.startsWith("image/")) {
    showError("请上传 JPG、PNG 或 WEBP 图片。");
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    showError("图片文件较大，建议压缩到 8MB 以内后再上传。");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    imageDataUrl = reader.result;
    imagePreview.src = imageDataUrl;
    previewArea.classList.add("has-image");
  };
  reader.onerror = () => showError("图片读取失败，请重新选择文件。");
  reader.readAsDataURL(file);
}

async function analyzeImage() {
  clearError();
  const apiKey = apiKeyInput.value.trim();
  const model = getModelName();

  if (!apiKey) {
    showError("请先输入阿里云百炼 API Key。");
    return;
  }

  if (!model) {
    showError("请输入可用的 Qwen-VL 模型名称。");
    return;
  }

  if (!imageDataUrl) {
    showError("请先上传一张驾驶员图片。");
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl
                }
              },
              {
                type: "text",
                text: buildUserPrompt()
              }
            ]
          }
        ],
        temperature: 0.2
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`接口请求失败，状态码 ${response.status}。${responseText}`);
    }

    const data = JSON.parse(responseText);
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";

    if (!content) {
      throw new Error("模型没有返回有效内容。");
    }

    const parsed = parseModelJson(content);
    renderReport(parsed || fallbackReport, content);
  } catch (error) {
    showError(`分析失败：${error.message} 请检查 API Key、模型权限、百炼服务开通状态和网络连接。`);
  } finally {
    setLoading(false);
  }
}

function buildUserPrompt() {
  const dimensions = Array.from(document.querySelectorAll('input[name="dimension"]:checked'))
    .map((item) => item.value)
    .join("、") || "综合疲劳驾驶风险";
  const scene = sceneContextInput.value.trim() || "未提供额外驾驶场景，请仅依据图像中可见信息判断。";

  return `请分析这张驾驶员图像。

【驾驶场景】
${scene}

【重点分析维度】
${dimensions}

请按系统要求输出严格 JSON。score 表示疲劳风险分数，0 为无风险，100 为极高风险。`;
}

function getModelName() {
  if (modelNameInput.value === "custom") {
    return customModelInput.value.trim();
  }
  return modelNameInput.value;
}

function parseModelJson(content) {
  try {
    return JSON.parse(stripCodeFence(content));
  } catch (firstError) {
    const match = stripCodeFence(content).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (secondError) {
      return null;
    }
  }
}

function stripCodeFence(text) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function renderReport(result, originalText) {
  const normalized = normalizeReport(result);
  const score = clampScore(normalized.score);
  const angle = Math.round(score * 3.6);
  const levelClass = getRiskClass(normalized.fatigue_level);
  const color = getRiskColor(normalized.fatigue_level, score);

  reportEmpty.classList.add("hidden");
  report.classList.remove("hidden");
  rawResponse.classList.remove("hidden");

  fatigueLevel.textContent = normalized.fatigue_level;
  fatigueLevel.className = levelClass;
  confidenceText.textContent = `置信度：${normalized.confidence}`;
  riskScore.textContent = `${score}`;
  scoreRing.style.background = `radial-gradient(circle at center, #fff 0 55%, transparent 57%), conic-gradient(${color} ${angle}deg, #d9e5ea ${angle}deg)`;
  meterFill.style.transform = `scaleX(${1 - score / 100})`;

  featureGrid.innerHTML = "";
  [
    ["眼睛状态", normalized.features.eyes],
    ["嘴部与打哈欠", normalized.features.mouth],
    ["头部姿态", normalized.features.head_pose],
    ["表情疲劳感", normalized.features.facial_expression],
    ["身体坐姿", normalized.features.body_posture]
  ].forEach(([title, text]) => {
    const item = document.createElement("div");
    item.className = "feature-item";
    item.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p>`;
    featureGrid.appendChild(item);
  });

  renderList(reasonList, normalized.risk_reasons);
  renderList(suggestionList, normalized.safety_suggestions);
  limitationsText.textContent = normalized.limitations;
  rawText.textContent = originalText;

  lastReportText = buildPlainReport(normalized, originalText);
}

function normalizeReport(result) {
  const features = result.features || {};
  return {
    fatigue_level: result.fatigue_level || "无法判断",
    score: result.score,
    confidence: result.confidence || "低",
    features: {
      eyes: features.eyes || "未说明",
      mouth: features.mouth || "未说明",
      head_pose: features.head_pose || "未说明",
      facial_expression: features.facial_expression || "未说明",
      body_posture: features.body_posture || "未说明"
    },
    risk_reasons: toArray(result.risk_reasons),
    safety_suggestions: toArray(result.safety_suggestions),
    limitations: result.limitations || "模型未提供限制说明。"
  };
}

function toArray(value) {
  if (Array.isArray(value) && value.length) return value;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return ["模型未提供该项内容。"];
}

function clampScore(score) {
  const numeric = Number(score);
  if (Number.isNaN(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function getRiskClass(level) {
  if (level.includes("高")) return "risk-high";
  if (level.includes("中")) return "risk-medium";
  if (level.includes("轻")) return "risk-mild";
  if (level.includes("正常")) return "risk-normal";
  return "";
}

function getRiskColor(level, score) {
  if (level.includes("高") || score >= 75) return "#c23b32";
  if (level.includes("中") || score >= 50) return "#bd7a12";
  if (level.includes("轻") || score >= 25) return "#355c9a";
  return "#2d8f78";
}

function renderList(target, items) {
  target.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    target.appendChild(li);
  });
}

function buildPlainReport(result, originalText) {
  return [
    "FatigueDrive-Agent 疲劳驾驶识别报告",
    `疲劳等级：${result.fatigue_level}`,
    `风险评分：${clampScore(result.score)}`,
    `置信度：${result.confidence}`,
    "",
    "视觉特征：",
    `- 眼睛状态：${result.features.eyes}`,
    `- 嘴部与打哈欠：${result.features.mouth}`,
    `- 头部姿态：${result.features.head_pose}`,
    `- 表情疲劳感：${result.features.facial_expression}`,
    `- 身体坐姿：${result.features.body_posture}`,
    "",
    "风险依据：",
    ...result.risk_reasons.map((item) => `- ${item}`),
    "",
    "安全建议：",
    ...result.safety_suggestions.map((item) => `- ${item}`),
    "",
    `限制说明：${result.limitations}`,
    "",
    "模型原始回复：",
    originalText
  ].join("\n");
}

async function copyReport() {
  if (!lastReportText) {
    showError("当前还没有可复制的报告。");
    return;
  }

  try {
    await navigator.clipboard.writeText(lastReportText);
    clearError();
  } catch (error) {
    showError("复制失败，请手动选择报告内容复制。");
  }
}

function resetAll() {
  form.reset();
  customModelInput.classList.add("hidden");
  imageDataUrl = "";
  imagePreview.removeAttribute("src");
  previewArea.classList.remove("has-image");
  report.classList.add("hidden");
  rawResponse.classList.add("hidden");
  reportEmpty.classList.remove("hidden");
  featureGrid.innerHTML = "";
  reasonList.innerHTML = "";
  suggestionList.innerHTML = "";
  rawText.textContent = "";
  lastReportText = "";
  clearError();
}

function setLoading(isLoading) {
  loading.classList.toggle("is-visible", isLoading);
  analyzeBtn.disabled = isLoading;
}

function showError(message) {
  errorBox.textContent = message;
}

function clearError() {
  errorBox.textContent = "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

if (window.lucide) {
  window.lucide.createIcons();
}
