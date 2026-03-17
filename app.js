const SUPABASE_URL = "https://dcxlxvfuggftnenqmmbk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_FLG1LIzPECfKa9FYZYCknQ_y-HVVbpY";
const BOARD_ENDPOINT = `${SUPABASE_URL}/rest/v1/board_posts`;
const BOARD_SELECT =
  "select=id,author,title,content,created_at&order=created_at.desc&limit=30";

const form = document.querySelector("#board-form");
const submitButton = document.querySelector("#board-submit");
const refreshButton = document.querySelector("#board-refresh");
const statusField = document.querySelector("#board-status");
const emptyState = document.querySelector("#board-empty");
const list = document.querySelector("#post-list");
const count = document.querySelector("#board-count");

const baseHeaders = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
};

function setStatus(message, tone = "default") {
  statusField.textContent = message;
  statusField.dataset.tone = tone;
}

function setPending(isPending) {
  submitButton.disabled = isPending;
  refreshButton.disabled = isPending;
  submitButton.textContent = isPending ? "저장 중..." : "글 올리기";
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function clearPosts() {
  list.replaceChildren();
  emptyState.hidden = false;
  count.textContent = "0개";
}

function createPostCard(post) {
  const article = document.createElement("article");
  article.className = "board-post";

  const head = document.createElement("div");
  head.className = "board-post-head";

  const copy = document.createElement("div");
  const author = document.createElement("span");
  author.className = "board-post-author";
  author.textContent = post.author;

  const title = document.createElement("h3");
  title.className = "board-post-title";
  title.textContent = post.title;

  const time = document.createElement("span");
  time.className = "board-post-time";
  time.textContent = formatDate(post.created_at);

  const body = document.createElement("p");
  body.className = "board-post-body";
  body.textContent = post.content;

  copy.append(author, title);
  head.append(copy, time);
  article.append(head, body);

  return article;
}

function renderPosts(posts) {
  list.replaceChildren();
  count.textContent = `${posts.length}개`;
  emptyState.hidden = posts.length > 0;

  if (!posts.length) {
    return;
  }

  const fragment = document.createDocumentFragment();

  posts.forEach((post) => {
    fragment.append(createPostCard(post));
  });

  list.append(fragment);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...baseHeaders,
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      (payload &&
        typeof payload === "object" &&
        (payload.message || payload.error || payload.details || payload.hint)) ||
      `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function getReadableError(error) {
  const message = error?.message ?? "알 수 없는 오류가 발생했습니다.";
  const lower = message.toLowerCase();

  if (
    lower.includes("board_posts") ||
    lower.includes("relation") ||
    lower.includes("schema cache")
  ) {
    return "Supabase SQL Editor에서 `supabase-board.sql` 파일 내용을 먼저 실행해 주세요.";
  }

  if (
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    error?.status === 401 ||
    error?.status === 403
  ) {
    return "RLS 정책이나 권한이 아직 없어서 접근이 막혀 있습니다. SQL 파일의 정책까지 함께 적용해 주세요.";
  }

  return `연결 오류: ${message}`;
}

async function loadPosts() {
  setStatus("게시글을 불러오는 중입니다.");

  try {
    const posts = await requestJson(`${BOARD_ENDPOINT}?${BOARD_SELECT}`, {
      cache: "no-store",
    });

    renderPosts(posts);

    if (posts.length) {
      setStatus("Supabase 게시판이 연결되었습니다.", "success");
    } else {
      setStatus("게시판은 연결됐습니다. 첫 글을 남겨보세요.");
    }
  } catch (error) {
    clearPosts();
    setStatus(getReadableError(error), "error");
  }
}

function validateField(label, value, minLength, maxLength) {
  const trimmed = value.trim();

  if (trimmed.length < minLength) {
    throw new Error(`${label}은(는) ${minLength}자 이상이어야 합니다.`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${label}은(는) ${maxLength}자 이하여야 합니다.`);
  }

  return trimmed;
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(form);

  try {
    const author = validateField("이름", formData.get("author"), 1, 24);
    const title = validateField("제목", formData.get("title"), 1, 80);
    const content = validateField("내용", formData.get("content"), 1, 1000);

    setPending(true);
    setStatus("글을 저장하는 중입니다.");

    await requestJson(BOARD_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify([
        {
          author,
          title,
          content,
        },
      ]),
    });

    form.reset();
    setStatus("게시글을 저장했습니다.", "success");
    await loadPosts();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "게시글 저장에 실패했습니다.";
    setStatus(message, "error");
  } finally {
    setPending(false);
  }
}

form.addEventListener("submit", handleSubmit);
refreshButton.addEventListener("click", loadPosts);

loadPosts();
