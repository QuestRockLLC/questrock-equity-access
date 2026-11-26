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
      line: "Start your journey with confidence.",
      body: "Review the required personal information, property details, and applicable disclosures.",
      short: "Review info",
    },
    {
      title: "Explore your options",
      line: "Find an offer that works for you.",
      body: "Review available financing options, credit line amounts, repayment terms, and associated fees. Prequalification is not final approval.",
      short: "Explore options",
    },
    {
      title: "Complete verification",
      line: "Verify your information.",
      body: "Complete required income, identity, or additional verification through Aven’s available methods.",
      short: "Verification",
    },
    {
      title: "Review your final offer",
      line: "Understand your terms before committing.",
      body: "Review the final offer, repayment terms, costs, and applicable conditions before deciding whether to accept.",
      short: "Final offer",
    },
    {
      title: "Arrange your closing",
      line: "Move forward on your schedule.",
      body: "Follow Aven’s closing instructions. Online or in-person closing requirements vary by property state. Georgia, South Carolina, and Texas may require an in-person closing.",
      short: "Closing",
    },
    {
      title: "Access your funds",
      line: "Move toward funding.",
      body: "Funds can be released following closing, applicable waiting periods, and clearance of outstanding conditions. Funding may be available in as little as five days. Timing is not guaranteed.",
      short: "Funding",
    },
  ];

  let stepIndex = 0;
  const track = document.getElementById("phoneTrack");
  const countEl = document.getElementById("walkCount");
  const barEl = document.getElementById("walkBar");
  const kickerEl = document.getElementById("walkKicker");
  const titleEl = document.getElementById("walkTitle");
  const lineEl = document.getElementById("walkLine");
  const bodyEl = document.getElementById("walkBody");
  const prevBtn = document.getElementById("walkPrev");
  const nextBtn = document.getElementById("walkNext");
  const times = document.getElementById("walkTimes");
  const phoneWindow = document.getElementById("phoneWindow");

  function setStep(next) {
    stepIndex = Math.max(0, Math.min(steps.length - 1, next));
    const step = steps[stepIndex];
    const n = String(stepIndex + 1).padStart(2, "0");
    countEl.textContent = n + " / 06";
    barEl.style.width = ((stepIndex + 1) / steps.length) * 100 + "%";
    kickerEl.textContent = "Step " + (stepIndex + 1);
    titleEl.textContent = step.title;
    lineEl.textContent = step.line;
    bodyEl.textContent = step.body;
    track.style.transform = "translateX(-" + stepIndex * 100 + "%)";
    prevBtn.disabled = stepIndex === 0;
    nextBtn.disabled = stepIndex === steps.length - 1;
    times.querySelectorAll("button").forEach((btn, i) => {
      if (i === stepIndex) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
    });
  }

  prevBtn.addEventListener("click", () => setStep(stepIndex - 1));
  nextBtn.addEventListener("click", () => setStep(stepIndex + 1));
  times.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-step]");
    if (!btn) return;
    setStep(Number(btn.dataset.step));
  });
  phoneWindow.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") setStep(stepIndex + 1);
    if (event.key === "ArrowLeft") setStep(stepIndex - 1);
    if (event.key === "Home") setStep(0);
    if (event.key === "End") setStep(steps.length - 1);
  });

  let touchX = null;
  phoneWindow.addEventListener("touchstart", (event) => {
    touchX = event.changedTouches[0].clientX;
  }, { passive: true });
  phoneWindow.addEventListener("touchend", (event) => {
    if (touchX == null) return;
    const dx = event.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) < 40) return;
    setStep(stepIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });

  setStep(0);

  const sticky = document.getElementById("stickyCta");
  const heroCta = document.getElementById("heroCta");
  if (sticky && heroCta && "IntersectionObserver" in window) {
    const mobile = window.matchMedia("(max-width: 850px)");
    const io = new IntersectionObserver((entries) => {
      const show = mobile.matches && !entries[0].isIntersecting && window.scrollY > 120;
      sticky.hidden = !show;
      document.body.classList.toggle("sticky-on", show);
    }, { threshold: 0, rootMargin: "0px 0px -40px 0px" });
    io.observe(heroCta);
    mobile.addEventListener("change", () => {
      if (!mobile.matches) {
        sticky.hidden = true;
        document.body.classList.remove("sticky-on");
      }
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
