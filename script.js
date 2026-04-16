(function(){
  var KEY = "theme";
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch(e){}
  var prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  var theme = saved || (prefersLight ? "light" : "dark");
  document.documentElement.setAttribute("data-theme", theme);

  function label(t){ return t === "dark" ? "☀ Light" : "☾ Dark"; }

  function mount(){
    if (document.querySelector(".theme-toggle")) return;
    var btn = document.createElement("button");
    btn.className = "theme-toggle";
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle light/dark theme");
    btn.textContent = label(theme);
    btn.addEventListener("click", function(){
      theme = theme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", theme);
      try { localStorage.setItem(KEY, theme); } catch(e){}
      btn.textContent = label(theme);
    });
    document.body.appendChild(btn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
