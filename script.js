// Shows one section at a time, chosen by the sidebar link (the URL hash).
(() => {
  document.documentElement.classList.add("js");
  const sections = [...document.querySelectorAll(".content section")];
  const links = [...document.querySelectorAll(".menu a")];

  function show() {
    const id = location.hash.slice(1);
    const target = sections.find((s) => s.id === id) || sections[0];
    sections.forEach((s) => s.classList.toggle("active", s === target));
    links.forEach((a) => {
      if (a.getAttribute("href") === "#" + target.id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (window.innerWidth <= 800 && id) {
      document.querySelector(".content").scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo(0, 0);
    }
  }

  window.addEventListener("hashchange", show);
  show();
})();
