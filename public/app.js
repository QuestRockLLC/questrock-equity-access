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
