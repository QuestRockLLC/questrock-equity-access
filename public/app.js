(function () {
  "use strict";
  const params = new URLSearchParams(location.search);
  const loHint = (params.get("utm_content") || params.get("lo") || "").toLowerCase();
  const stateHint = (params.get("state") || "").toUpperCase();
  const modal = document.getElementById("modal");
  const statusEl = document.getElementById("status");
  const continueBtn = document.getElementById("continue");
  const closeBtn = document.getElementById("close");
  const stateBox = document.getElementById("states");
  let selected = "";
  let trigger = null;

  const options = [
    { value: "GA", label: "Georgia" },
    { value: "FL", label: "Florida" },
    { value: "TN", label: "Tennessee" },
    { value: "NC", label: "North Carolina" },
    { value: "SC", label: "South Carolina" },
    { value: "TX", label: "Texas" },
    { value: "AL", label: "Alabama" },
    { value: "KY", label: "Kentucky" },
    { value: "OTHER", label: "Other / not listed" },
  ];

  const messages = {
    unsupported: "This page is for properties in Georgia, Florida, Tennessee, North Carolina, South Carolina, Texas, Alabama, and Kentucky.",
    unmapped: "This property state is not available for an automatic handoff from this page. No application was started.",
    invalid: "That selection could not be used. No application was started.",
    rejected: "The destination could not be verified. No application was started.",
    network: "The destination could not be verified. No application was started.",
  };

  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "state";
    btn.textContent = opt.label;
    btn.dataset.value = opt.value;
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => choose(opt.value));
    stateBox.appendChild(btn);
  });

  function choose(value) {
    selected = value;
    stateBox.querySelectorAll("button").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.value === value));
    });
    continueBtn.disabled = !value || value === "OTHER";
    if (value === "OTHER") {
      statusEl.hidden = false;
      statusEl.className = "status error";
      statusEl.textContent = messages.unsupported;
    } else {
      statusEl.hidden = true;
      statusEl.textContent = "";
    }
  }

  function openModal(from) {
    trigger = from;
    selected = "";
    choose("");
    if (stateHint && options.some((o) => o.value === stateHint)) choose(stateHint);
    modal.showModal();
  }

  function closeModal() {
    modal.close();
  }

  async function continueToAven() {
    if (!selected || selected === "OTHER") {
      statusEl.hidden = false;
      statusEl.className = "status error";
      statusEl.textContent = messages.unsupported;
      continueBtn.disabled = true;
      return;
    }
    continueBtn.disabled = true;
    try {
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: selected, loHint }),
      });
      const data = await res.json();
      if (!data.ok || !data.url) {
        statusEl.hidden = false;
        statusEl.className = "status error";
        statusEl.textContent = messages[data.code] || messages.unmapped;
        continueBtn.disabled = true;
        return;
      }
      window.location.assign(data.url);
    } catch {
      statusEl.hidden = false;
      statusEl.className = "status error";
      statusEl.textContent = messages.network;
      continueBtn.disabled = true;
    } finally {
      if (!statusEl.hidden) return;
      continueBtn.disabled = !selected || selected === "OTHER";
    }
  }

  document.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn));
  });
  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("close", () => {
    if (trigger && typeof trigger.focus === "function") trigger.focus();
  });
  continueBtn.addEventListener("click", continueToAven);

  const steps = [
    {
      title: "Review your information",
      body: "Confirm your details and disclosures.",
      short: "Info",
      src: "/aven-ui/step-01-info.webp",
      alt: "Example Aven screen for reviewing information and consents",
    },
    {
      title: "See your options",
      body: "Look at a sample offer and terms.",
      short: "Options",
      src: "/aven-ui/step-02-options.webp",
      alt: "Example Aven screen for reviewing a prequalified offer",
    },
    {
      title: "Verify",
      body: "Confirm income or identity if asked.",
      short: "Verify",
      src: "/aven-ui/step-03-verify.webp",
      alt: "Example Aven screen for income verification",
    },
    {
      title: "Review your offer",
      body: "Check the terms before you accept.",
      short: "Offer",
      src: "/aven-ui/step-04-offer.webp",
      alt: "Example Aven screen for reviewing a final offer",
    },
    {
      title: "Arrange closing",
      body: "Schedule signing, online or in person.",
      short: "Closing",
      src: "/aven-ui/step-05-closing.webp",
      alt: "Example Aven screen for scheduling closing",
    },
    {
      title: "Access your funds",
      body: "After closing, funds can be released.",
      short: "Funding",
      src: "/aven-ui/step-06-funding.webp",
      alt: "Example Aven screen describing funding after closing",
    },
  ];

  let stepIndex = 0;
  const countEl = document.getElementById("walkCount");
  const barEl = document.getElementById("walkBar");
  const titleEl = document.getElementById("walkTitle");
  const bodyEl = document.getElementById("walkBody");
  const imageEl = document.getElementById("walkImage");
  const prevBtn = document.getElementById("walkPrev");
  const nextBtn = document.getElementById("walkNext");
  const times = document.getElementById("walkTimes");
  const phoneWindow = document.getElementById("phoneWindow");
  const walkCard = document.getElementById("walkCard");

  steps.forEach((step, i) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "walk-tab";
    tab.innerHTML = "<b>0" + (i + 1) + "</b>" + step.short;
    tab.addEventListener("click", () => setStep(i));
    times.appendChild(tab);
    barEl.appendChild(document.createElement("span"));
  });

  function setStep(next) {
    stepIndex = Math.max(0, Math.min(steps.length - 1, next));
    const step = steps[stepIndex];
    countEl.textContent = String(stepIndex + 1).padStart(2, "0") + " / 06";
    titleEl.textContent = step.title;
    bodyEl.textContent = step.body;
    imageEl.src = step.src;
    imageEl.alt = step.alt;
    imageEl.style.animation = "none";
    requestAnimationFrame(() => { imageEl.style.animation = ""; });
    Array.from(times.children).forEach((btn, i) => {
      if (i === stepIndex) btn.setAttribute("aria-current", "step");
      else btn.removeAttribute("aria-current");
    });
    Array.from(barEl.children).forEach((seg, i) => {
      seg.classList.toggle("current", i <= stepIndex);
    });
    prevBtn.disabled = stepIndex === 0;
    nextBtn.disabled = stepIndex === steps.length - 1;
    nextBtn.textContent = nextBtn.disabled ? "Journey complete ✓" : "Next step →";
  }

  prevBtn.addEventListener("click", () => setStep(stepIndex - 1));
  nextBtn.addEventListener("click", () => setStep(stepIndex + 1));
  walkCard.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      setStep(stepIndex + (event.key === "ArrowRight" ? 1 : -1));
    }
    if (event.key === "Home") setStep(0);
    if (event.key === "End") setStep(steps.length - 1);
  });

  let touchX = null;
  let touchY = null;
  phoneWindow.addEventListener("touchstart", (event) => {
    touchX = event.changedTouches[0].clientX;
    touchY = event.changedTouches[0].clientY;
  }, { passive: true });
  phoneWindow.addEventListener("touchend", (event) => {
    if (touchX == null) return;
    const dx = event.changedTouches[0].clientX - touchX;
    const dy = event.changedTouches[0].clientY - touchY;
    touchX = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    setStep(stepIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });

  setStep(0);

  const sticky = document.getElementById("stickyCta");
  const heroCta = document.getElementById("heroCta");
  const finalCta = document.querySelector(".final-card [data-open]");
  if (sticky && heroCta && "IntersectionObserver" in window) {
    let heroVisible = true;
    let finalVisible = false;
    function updateSticky() {
      const show = !heroVisible && !finalVisible && !modal.open && window.scrollY > 80;
      sticky.hidden = !show;
      document.body.classList.toggle("sticky-on", show);
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === heroCta) heroVisible = entry.isIntersecting;
        if (entry.target === finalCta) finalVisible = entry.isIntersecting;
      });
      updateSticky();
    }, { threshold: 0, rootMargin: "0px 0px -40px 0px" });
    io.observe(heroCta);
    if (finalCta) io.observe(finalCta);
    window.addEventListener("scroll", updateSticky, { passive: true });
    modal.addEventListener("close", updateSticky);
    document.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        sticky.hidden = true;
        document.body.classList.remove("sticky-on");
      });
    });
  }

  const reviews = [
    {
      quote: "Working with the team at QuestRock was an easy and seamless experience. They answered any and all questions I had along the way, and were very patient throughout the process. I highly recommend them!",
      who: "Sean Murphy – Woodstock, GA",
    },
    {
      quote: "QuestRock was absolutely the best service and support we’ve ever experienced during our latest purchase! Without a doubt will use them again.",
      who: "Zac Campbell – Buckhead, GA",
    },
    {
      quote: "QuestRock is awesome! Other lenders could not deal with Self Employment and a 160 page tax return, K-1s etc. Thanks for pulling this all together and making a miracle happen!",
      who: "Doug Marranci",
    },
    {
      quote: "Excellent, very professional group. Got approved for refinance in less than 30 days. They worked closely with us and found ways to save us money. Highly recommended!",
      who: "Bill Chambers",
    },
  ];

  const list = document.getElementById("reviewlist");
  let idx = 0;

  function visibleCount() {
    return window.matchMedia("(max-width: 600px)").matches ? 1 : 3;
  }

  function renderReviews() {
    const count = visibleCount();
    list.replaceChildren();
    for (let i = 0; i < count; i += 1) {
      const item = reviews[(idx + i) % reviews.length];
      const article = document.createElement("article");
      article.className = "review";
      article.innerHTML = `<div class="stars" aria-hidden="true">★★★★★</div><h3>“${item.quote}”</h3><footer>${item.who}</footer>`;
      list.appendChild(article);
    }
  }

  document.getElementById("reviewNext").addEventListener("click", () => {
    idx = (idx + 1) % reviews.length;
    renderReviews();
  });
  document.getElementById("reviewPrev").addEventListener("click", () => {
    idx = (idx + reviews.length - 1) % reviews.length;
    renderReviews();
  });
  window.addEventListener("resize", renderReviews);
  renderReviews();
})();
