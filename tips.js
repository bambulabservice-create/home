const themeToggle = document.querySelector("#theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');

function setTheme(isDark) {
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Schakel naar light theme" : "Schakel naar dark theme");
  themeToggle.querySelector(".theme-icon").textContent = isDark ? "☀" : "☾";
  themeToggle.querySelector(".theme-label").textContent = isDark ? "Light theme" : "Dark theme";
  themeColor.content = isDark ? "#10172b" : "#f4f6fb";
}

setTheme(localStorage.getItem("hpm-theme") === "dark");

themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.dataset.theme !== "dark";
  setTheme(isDark);
  localStorage.setItem("hpm-theme", isDark ? "dark" : "light");
});
