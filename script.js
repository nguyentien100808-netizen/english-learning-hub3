const $ = (selector) => document.querySelector(selector);

const userText = $("#userText");
const analyzeButton = $("#analyzeButton");
const clearButton = $("#clearButton");
const errorMessage = $("#errorMessage");
const results = $("#results");
const charCount = $("#charCount");

userText.addEventListener("input", () => {
  charCount.textContent = `${userText.value.length.toLocaleString("vi-VN")} ký tự`;
  errorMessage.hidden = true;
});

clearButton.addEventListener("click", () => {
  userText.value = "";
  charCount.textContent = "0 ký tự";
  errorMessage.hidden = true;
  userText.focus();
});

analyzeButton.addEventListener("click", analyzeWriting);

$("#copyCorrected").addEventListener("click", async () => {
  const text = $("#correctedText").textContent;
  try {
    await navigator.clipboard.writeText(text);
    $("#copyCorrected").textContent = "Đã sao chép ✓";
    setTimeout(() => { $("#copyCorrected").textContent = "Sao chép bản sửa"; }, 1800);
  } catch {
    showError("Trình duyệt không cho phép sao chép tự động. Bạn hãy bôi đen bản sửa và sao chép thủ công.");
  }
});

function analyzeWriting() {
  const text = userText.value.trim();
  if (!text) {
    showError("Bạn hãy nhập đoạn văn tiếng Anh trước khi phân tích nhé.");
    userText.focus();
    return;
  }

  setLoading(true);
  errorMessage.hidden = true;

  // Phân tích cục bộ bằng các quy tắc đơn giản; không gọi API hay gửi dữ liệu đi đâu.
  try {
    const data = analyzeLocally(text);
    renderResults(text, data);
    results.hidden = false;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showError("Không thể phân tích đoạn văn này. Bạn hãy thử lại nhé.");
  } finally {
    setLoading(false);
  }
}

function analyzeLocally(text) {
  let corrected = text;
  const corrections = [];
  const rules = [
    { pattern: /\bi\b/g, replacement: "I", type: "Viết hoa", explanation: "Đại từ “I” trong tiếng Anh luôn được viết hoa." },
    { pattern: /\bdont\b/gi, replacement: "don't", type: "Chính tả", explanation: "Dạng phủ định chuẩn cần dấu nháy đơn." },
    { pattern: /\bdoesnt\b/gi, replacement: "doesn't", type: "Chính tả", explanation: "Dạng phủ định chuẩn cần dấu nháy đơn." },
    { pattern: /\bcant\b/gi, replacement: "can't", type: "Chính tả", explanation: "Dạng phủ định chuẩn cần dấu nháy đơn." },
    { pattern: /\bwont\b/gi, replacement: "won't", type: "Chính tả", explanation: "Dạng phủ định chuẩn cần dấu nháy đơn." },
    { pattern: /\bdidnt\b/gi, replacement: "didn't", type: "Chính tả", explanation: "Dạng phủ định chuẩn cần dấu nháy đơn." },
    { pattern: /\bdoesn't\s+([a-z]+)s\b/gi, replacement: "doesn't $1", type: "Ngữ pháp", explanation: "Sau “doesn't”, động từ chính thường dùng dạng nguyên mẫu." },
    { pattern: /\bhe\s+go\b/gi, replacement: "he goes", type: "Chia động từ", explanation: "Ở thì hiện tại đơn, chủ ngữ “he/she/it” thường đi với động từ thêm -s/-es." },
    { pattern: /\bshe\s+go\b/gi, replacement: "she goes", type: "Chia động từ", explanation: "Ở thì hiện tại đơn, chủ ngữ “he/she/it” thường đi với động từ thêm -s/-es." },
    { pattern: /\bit\s+go\b/gi, replacement: "it goes", type: "Chia động từ", explanation: "Ở thì hiện tại đơn, chủ ngữ “he/she/it” thường đi với động từ thêm -s/-es." },
    { pattern: /\bpeople is\b/gi, replacement: "people are", type: "Hòa hợp chủ-vị", explanation: "“People” thường là danh từ số nhiều nên dùng “are”." },
    { pattern: /\bvery good\b/gi, replacement: "excellent", type: "Từ vựng", explanation: "“Excellent” có thể giúp cách diễn đạt ngắn gọn và đa dạng hơn, tùy ngữ cảnh." },
    { pattern: /\ba lot of things\b/gi, replacement: "many things", type: "Diễn đạt", explanation: "“Many things” có thể gọn hơn trong một số ngữ cảnh." }
  ];

  for (const rule of rules) {
    const before = corrected;
    corrected = corrected.replace(rule.pattern, rule.replacement);
    if (before !== corrected) {
      corrections.push({
        original: rule.pattern.source === "\\bi\\b" ? "i" : rule.pattern.source.replace(/\\b/g, "").replace(/[\\^$]/g, ""),
        correction: rule.replacement,
        type: rule.type,
        explanation: rule.explanation
      });
    }
  }

  // Chuẩn hóa khoảng trắng và dấu câu cơ bản.
  const beforePunctuation = corrected;
  corrected = corrected
    .replace(/[ \t]+([,.!?;:])/g, "$1")
    .replace(/([,.!?;:])([A-Za-z])/g, "$1 $2")
    .replace(/(^\s*[a-z])/, (match) => match.toUpperCase())
    .replace(/([.!?]\s+)([a-z])/g, (match, sep, letter) => sep + letter.toUpperCase())
    .trim();

  if (beforePunctuation !== corrected) {
    corrections.push({
      original: "Khoảng trắng / viết hoa",
      correction: "Đã chuẩn hóa dấu câu và chữ đầu câu",
      type: "Dấu câu",
      explanation: "Đã áp dụng một số quy tắc trình bày cơ bản."
    });
  }

  const words = text.match(/\b[A-Za-z']+\b/g) || [];
  const uniqueWords = [...new Set(words.map(w => w.toLowerCase()).filter(w => w.length > 5))].slice(0, 8);
  const vocabulary = uniqueWords.map(word => ({
    word,
    ipa: "—",
    meaning_vi: "Tra nghĩa trong từ điển để xác nhận theo ngữ cảnh.",
    example: `Ví dụ của bạn: ${word}`
  }));

  const sentenceCount = (text.match(/[.!?]+(?=\s|$)/g) || []).length || 1;
  const feedback = corrections.length
    ? `Công cụ tìm thấy ${corrections.length} điểm có thể chỉnh sửa theo các quy tắc cơ bản. Hãy kiểm tra từng gợi ý vì một số cách dùng phụ thuộc vào ngữ cảnh. Đoạn văn có khoảng ${words.length} từ và ${sentenceCount} câu.`
    : `Chưa phát hiện lỗi thuộc nhóm quy tắc cơ bản mà công cụ kiểm tra. Điều này không có nghĩa là bài viết hoàn toàn chính xác; công cụ chưa đánh giá được đầy đủ ngữ cảnh, lập luận hoặc sắc thái ngôn ngữ. Đoạn văn có khoảng ${words.length} từ và ${sentenceCount} câu.`;

  const rephrasing = corrected !== text
    ? [`Bản diễn đạt sau khi áp dụng các chỉnh sửa cơ bản:\n${corrected}`]
    : ["Hãy thử dùng từ nối như “However”, “Moreover” hoặc “For example” khi phù hợp để làm rõ mối liên kết giữa các ý."];

  return {
    corrected_text: corrected,
    overall_feedback: feedback,
    corrections,
    advanced_rephrasing: rephrasing,
    vocabulary_bank: vocabulary
  };
}

function renderResults(original, data) {
  $("#originalText").textContent = original;
  $("#correctedText").textContent = data.corrected_text || "Chưa có bản sửa.";
  $("#overallFeedback").textContent = data.overall_feedback || "Chưa có nhận xét.";

  const correctionsList = $("#correctionsList");
  correctionsList.replaceChildren();
  const corrections = Array.isArray(data.corrections) ? data.corrections : [];
  if (!corrections.length) {
    correctionsList.append(createNotice("Không có lỗi cụ thể nào được trả về."));
  } else {
    corrections.forEach((item) => {
      const card = document.createElement("div");
      card.className = "correction-item";
      const top = document.createElement("div");
      top.className = "correction-pair";
      top.append(
        makeText("span", item.original || "", "original-phrase"),
        makeText("span", "→", "pair-arrow"),
        makeText("span", item.correction || "", "corrected-phrase")
      );
      card.append(top);
      if (item.type) card.append(makeText("span", item.type, "type-tag"));
      if (item.explanation) card.append(makeText("p", item.explanation, "explanation"));
      correctionsList.append(card);
    });
  }

  const rephrasingList = $("#rephrasingList");
  rephrasingList.replaceChildren();
  const alternatives = Array.isArray(data.advanced_rephrasing) ? data.advanced_rephrasing : [];
  if (!alternatives.length) rephrasingList.append(createNotice("Chưa có gợi ý viết lại."));
  alternatives.forEach((value, index) => {
    const item = document.createElement("div");
    item.className = "rephrasing-item";
    item.append(makeText("span", `Cách ${index + 1}`, "type-tag"));
    item.append(makeText("p", value, "result-text"));
    rephrasingList.append(item);
  });

  const vocabularyList = $("#vocabularyList");
  vocabularyList.replaceChildren();
  const words = Array.isArray(data.vocabulary_bank) ? data.vocabulary_bank : [];
  if (!words.length) {
    const row = document.createElement("tr");
    const cell = makeText("td", "Chưa có từ vựng được gợi ý.", "");
    cell.colSpan = 4;
    row.append(cell);
    vocabularyList.append(row);
  } else {
    words.forEach((word) => {
      const row = document.createElement("tr");
      [word.word, word.ipa, word.meaning_vi, word.example].forEach((value) => {
        row.append(makeText("td", value || "—", ""));
      });
      vocabularyList.append(row);
    });
  }
}

function makeText(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function createNotice(text) {
  return makeText("p", text, "empty-state");
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function setLoading(isLoading) {
  analyzeButton.disabled = isLoading;
  analyzeButton.innerHTML = isLoading
    ? '<span class="spinner" aria-hidden="true"></span> Đang phân tích...'
    : '<span>✨</span> Phân tích & sửa bài <span class="button-arrow">→</span>';
}
