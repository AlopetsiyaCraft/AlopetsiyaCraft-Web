try {
  var alopeTheme = localStorage.getItem("theme");
  if (alopeTheme === "light") {
    document.documentElement.classList.add("light");
  }
} catch {}