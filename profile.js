let profileData = null;

const form = document.getElementById("searchForm");
const usernameInput = document.getElementById("usernameInput");
const profile = document.getElementById("profile");
const message = document.getElementById("message");
const toast = document.getElementById("toast");

const profileName = document.getElementById("profileName");
const profileLink = document.getElementById("profileLink");
const metalValue = document.getElementById("metalValue");
const lootBoxesOpened = document.getElementById("lootBoxesOpened");
const cosmeticCount = document.getElementById("cosmeticCount");
const textEffectCount = document.getElementById("textEffectCount");
const cosmeticsList = document.getElementById("cosmeticsList");
const textEffectsList = document.getElementById("textEffectsList");
const currentTextEffect = document.getElementById("currentTextEffect");
const recentUnlocks = document.getElementById("recentUnlocks");

function normaliseUsername(username) {
  return (username || "").trim().toLowerCase();
}

function getInitialUsername() {
  const params = new URLSearchParams(window.location.search);
  return params.get("u") || params.get("username") || "";
}

function showMessage(text) {
  message.textContent = text;
  message.classList.remove("hidden");
}

function hideMessage() {
  message.classList.add("hidden");
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2400);
}

function emptyText(text) {
  const div = document.createElement("div");
  div.className = "muted empty";
  div.textContent = text;
  return div;
}

function rarityClass(rarity) {
  return `rarity-${(rarity || "common").toLowerCase()}`;
}

function formatGeneratedAt(timestamp) {
  if (!timestamp) return "";
  try {
    return `Data updated ${new Date(timestamp * 1000).toLocaleString()}`;
  } catch {
    return "";
  }
}

function copyText(text) {
  if (!text) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Copied: ${text}`);
    }).catch(() => fallbackCopyText(text));
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.focus();
  input.select();
  document.execCommand("copy");
  input.remove();
  showToast(`Copied: ${text}`);
}

function makeItem(item, options = {}) {
  const div = document.createElement("div");
  div.className = `item ${rarityClass(item.rarity)}`;

  const left = document.createElement("div");
  left.className = "item-left";

  const name = document.createElement("div");
  name.className = "item-name";
  name.textContent = item.name || "Unknown";

  if (options.effectClass && item.class_name) {
    name.classList.add(item.class_name);
  }

  const meta = document.createElement("div");
  meta.className = "item-meta";
  meta.textContent = [item.category, item.rarity].filter(Boolean).join(" • ");

  left.appendChild(name);
  left.appendChild(meta);
  div.appendChild(left);

  if (options.copyCommand && item.equip_command) {
    div.classList.add("clickable");
    div.title = `Copy ${item.equip_command}`;

    const button = document.createElement("button");
    button.className = "copy-button";
    button.type = "button";
    button.textContent = "Copy command";

    const doCopy = (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyText(item.equip_command);
    };

    div.addEventListener("click", doCopy);
    button.addEventListener("click", doCopy);
    div.appendChild(button);
  }

  return div;
}

function renderList(container, items, emptyMessage, options = {}) {
  container.innerHTML = "";

  if (!items || items.length === 0) {
    container.appendChild(emptyText(emptyMessage));
    return;
  }

  for (const item of items) {
    container.appendChild(makeItem(item, options));
  }
}

function renderProfile(data, username) {
  profileName.textContent = data.username || username || "Unknown";
  profileLink.textContent = formatGeneratedAt(profileData && profileData.generated_at);
  metalValue.textContent = data.metal && data.metal.available ? data.metal.amount : "Private";
  metalValue.title = data.metal && data.metal.message ? data.metal.message : "";
  lootBoxesOpened.textContent = data.loot_boxes_opened || 0;

  const cosmeticsUnlocked = data.totals && data.totals.cosmetics_unlocked ? data.totals.cosmetics_unlocked : 0;
  const cosmeticsAvailable = data.totals && data.totals.cosmetics_available ? data.totals.cosmetics_available : (profileData.catalog ? profileData.catalog.cosmetics_total : 0);
  const effectsUnlocked = data.totals && data.totals.text_effects_unlocked ? data.totals.text_effects_unlocked : 0;
  const effectsAvailable = data.totals && data.totals.text_effects_available ? data.totals.text_effects_available : (profileData.catalog ? profileData.catalog.text_effects_total : 0);

  cosmeticCount.textContent = `${cosmeticsUnlocked}/${cosmeticsAvailable}`;
  textEffectCount.textContent = `${effectsUnlocked}/${effectsAvailable}`;

  renderList(
    cosmeticsList,
    data.cosmetics_unlocked,
    "No cosmetics unlocked yet."
  );

  renderList(
    textEffectsList,
    data.text_effects_unlocked,
    "No text effects unlocked yet.",
    { effectClass: true, copyCommand: true }
  );

  currentTextEffect.className = "current-effect";
  currentTextEffect.textContent = "None equipped";

  if (data.current_text_effect) {
    currentTextEffect.textContent = data.current_text_effect.name;
    if (data.current_text_effect.class_name) {
      currentTextEffect.classList.add(data.current_text_effect.class_name);
    }
  } else {
    currentTextEffect.classList.add("muted");
  }

  const recent = (data.recent_unlocks || []).map((item) => ({
    ...item,
    class_name: item.text_effect || ""
  }));

  renderList(
    recentUnlocks,
    recent,
    "No recent unlocks yet.",
    { effectClass: true }
  );

  profile.classList.remove("hidden");
  hideMessage();
}

async function loadData() {
  if (profileData) return profileData;

  const response = await fetch(`profile_data.json?cache=${Date.now()}`);
  if (!response.ok) {
    throw new Error("Could not load profile_data.json. Has the bot exported the viewer site data yet?");
  }

  profileData = await response.json();
  return profileData;
}

async function loadProfile(username) {
  username = normaliseUsername(username);

  if (!username) {
    showMessage("Enter a Twitch username first.");
    return;
  }

  showMessage("Loading profile...");

  try {
    const data = await loadData();
    const viewers = data.viewers || {};
    const viewer = viewers[username];

    if (!viewer) {
      profile.classList.add("hidden");
      showMessage(`No profile found for ${username} yet. Open a Loot Chest or unlock something first.`);
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("u", username);
    window.history.replaceState({}, "", url);

    renderProfile(viewer, username);
  } catch (error) {
    profile.classList.add("hidden");
    showMessage(error.message || "Could not load profile.");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadProfile(usernameInput.value);
});

const initialUsername = getInitialUsername();
if (initialUsername) {
  usernameInput.value = initialUsername;
  loadProfile(initialUsername);
}
