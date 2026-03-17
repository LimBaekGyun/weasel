import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://dcxlxvfuggftnenqmmbk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_FLG1LIzPECfKa9FYZYCknQ_y-HVVbpY";
const POSTS_LIMIT = 30;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const state = {
  posts: [],
  user: null,
  isAdmin: false,
};

const form = document.querySelector("#board-form");
const submitButton = document.querySelector("#board-submit");
const refreshButton = document.querySelector("#board-refresh");
const statusField = document.querySelector("#board-status");
const emptyState = document.querySelector("#board-empty");
const list = document.querySelector("#post-list");
const count = document.querySelector("#board-count");

const adminLoginForm = document.querySelector("#admin-login-form");
const adminEmailInput = document.querySelector("#admin-email");
const adminLoginButton = document.querySelector("#admin-login");
const adminLogoutButton = document.querySelector("#admin-logout");
const adminBadge = document.querySelector("#admin-badge");
const adminStatusField = document.querySelector("#admin-status");

function setStatus(message, tone = "default") {
  statusField.textContent = message;
  statusField.dataset.tone = tone;
}

function setAdminStatus(message, tone = "default") {
  adminStatusField.textContent = message;
  adminStatusField.dataset.tone = tone;
}

function setPostPending(isPending) {
  submitButton.disabled = isPending;
  refreshButton.disabled = isPending;
  submitButton.textContent = isPending ? "저장 중..." : "글 올리기";
}

function setAuthPending(isPending) {
  adminLoginButton.disabled = isPending;
  adminEmailInput.disabled = isPending;
  adminLoginButton.textContent = isPending
    ? "링크 보내는 중..."
    : "매직 링크 보내기";
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

function updateAdminUi() {
  const userEmail = state.user?.email ?? "";

  if (!state.user) {
    adminBadge.dataset.state = "signed-out";
    adminBadge.textContent = "로그아웃 상태";
    adminLogoutButton.hidden = true;
    adminEmailInput.value = "";
    setAdminStatus("관리자 로그인 전입니다.");
    return;
  }

  adminLogoutButton.hidden = false;
  adminEmailInput.value = userEmail;

  if (state.isAdmin) {
    adminBadge.dataset.state = "admin";
    adminBadge.textContent = "관리자";
    setAdminStatus(
      `${userEmail} 계정으로 로그인했습니다. 삭제 버튼이 활성화되었습니다.`,
      "success"
    );
    return;
  }

  adminBadge.dataset.state = "signed-in";
  adminBadge.textContent = "일반 로그인";
  setAdminStatus(
    `${userEmail} 계정으로 로그인했지만 관리자 목록에 등록되지 않아 삭제 권한은 없습니다.`
  );
}

function createDeleteButton(postId) {
  const button = document.createElement("button");
  button.className = "post-delete";
  button.type = "button";
  button.textContent = "삭제";
  button.addEventListener("click", async () => {
    const confirmed = window.confirm("이 게시글을 삭제할까요?");

    if (!confirmed) {
      return;
    }

    try {
      setStatus("게시글을 삭제하는 중입니다.");
      const { error } = await supabase
        .from("board_posts")
        .delete()
        .eq("id", postId);

      if (error) {
        throw error;
      }

      setStatus("게시글을 삭제했습니다.", "success");
      await loadPosts();
    } catch (error) {
      setStatus(getReadableError(error), "error");
    }
  });

  return button;
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

  const controls = document.createElement("div");
  controls.className = "board-post-controls";

  const time = document.createElement("span");
  time.className = "board-post-time";
  time.textContent = formatDate(post.created_at);

  controls.append(time);

  if (state.isAdmin) {
    controls.append(createDeleteButton(post.id));
  }

  const body = document.createElement("p");
  body.className = "board-post-body";
  body.textContent = post.content;

  copy.append(author, title);
  head.append(copy, controls);
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

function getReadableError(error) {
  const message = error?.message ?? "알 수 없는 오류가 발생했습니다.";
  const lower = message.toLowerCase();

  if (
    lower.includes("board_posts") ||
    lower.includes("board_admins") ||
    lower.includes("relation") ||
    lower.includes("schema cache")
  ) {
    return "Supabase SQL Editor에서 최신 `supabase-board.sql` 파일 내용을 다시 실행해 주세요.";
  }

  if (
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("jwt") ||
    lower.includes("not authenticated") ||
    lower.includes("invalid login") ||
    error?.status === 401 ||
    error?.status === 403
  ) {
    return "권한 설정이 아직 끝나지 않았습니다. SQL 정책과 관리자 로그인을 확인해 주세요.";
  }

  return `연결 오류: ${message}`;
}

async function refreshAdminState() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    state.user = null;
    state.isAdmin = false;
    updateAdminUi();
    setAdminStatus(getReadableError(userError), "error");
    renderPosts(state.posts);
    return;
  }

  state.user = user ?? null;
  state.isAdmin = false;

  if (!state.user) {
    updateAdminUi();
    renderPosts(state.posts);
    return;
  }

  const { data, error } = await supabase
    .from("board_admins")
    .select("email")
    .limit(1);

  if (error) {
    updateAdminUi();
    setAdminStatus(getReadableError(error), "error");
    renderPosts(state.posts);
    return;
  }

  state.isAdmin = Array.isArray(data) && data.length > 0;
  updateAdminUi();
  renderPosts(state.posts);
}

async function loadPosts() {
  setStatus("게시글을 불러오는 중입니다.");

  try {
    const { data, error } = await supabase
      .from("board_posts")
      .select("id, author, title, content, created_at")
      .order("created_at", { ascending: false })
      .limit(POSTS_LIMIT);

    if (error) {
      throw error;
    }

    state.posts = data ?? [];
    renderPosts(state.posts);

    if (state.posts.length) {
      setStatus("Supabase 게시판이 연결되었습니다.", "success");
    } else {
      setStatus("게시판은 연결됐습니다. 첫 글을 남겨보세요.");
    }
  } catch (error) {
    state.posts = [];
    clearPosts();
    setStatus(getReadableError(error), "error");
  }
}

function validateField(label, value, minLength, maxLength) {
  const trimmed = String(value ?? "").trim();

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

    setPostPending(true);
    setStatus("글을 저장하는 중입니다.");

    const { error } = await supabase.from("board_posts").insert({
      author,
      title,
      content,
    });

    if (error) {
      throw error;
    }

    form.reset();
    setStatus("게시글을 저장했습니다.", "success");
    await loadPosts();
  } catch (error) {
    const message =
      error instanceof Error
        ? getReadableError(error)
        : "게시글 저장에 실패했습니다.";
    setStatus(message, "error");
  } finally {
    setPostPending(false);
  }
}

async function handleLogin(event) {
  event.preventDefault();

  try {
    const formData = new FormData(adminLoginForm);
    const email = validateField("관리자 이메일", formData.get("email"), 5, 320);
    const redirectUrl = new URL(window.location.href);
    redirectUrl.hash = "";

    setAuthPending(true);
    setAdminStatus("매직 링크를 보내는 중입니다.");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl.toString(),
      },
    });

    if (error) {
      throw error;
    }

    setAdminStatus(
      "이메일로 매직 링크를 보냈습니다. 메일을 열고 다시 이 페이지로 돌아오세요.",
      "success"
    );
  } catch (error) {
    const message =
      error instanceof Error ? getReadableError(error) : "로그인 요청에 실패했습니다.";
    setAdminStatus(message, "error");
  } finally {
    setAuthPending(false);
  }
}

async function handleLogout() {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    state.user = null;
    state.isAdmin = false;
    updateAdminUi();
    renderPosts(state.posts);
    setAdminStatus("로그아웃했습니다.");
  } catch (error) {
    setAdminStatus(getReadableError(error), "error");
  }
}

function clearAuthCallbackHash() {
  if (!window.location.hash.includes("access_token")) {
    return;
  }

  const nextUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState({}, document.title, nextUrl);
}

async function initialize() {
  await loadPosts();
  await refreshAdminState();
  clearAuthCallbackHash();
}

form.addEventListener("submit", handleSubmit);
refreshButton.addEventListener("click", loadPosts);
adminLoginForm.addEventListener("submit", handleLogin);
adminLogoutButton.addEventListener("click", handleLogout);

supabase.auth.onAuthStateChange(async () => {
  await refreshAdminState();
});

initialize();
