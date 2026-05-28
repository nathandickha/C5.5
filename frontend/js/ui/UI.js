// js/ui/UI.js

export function setupSidePanels() {
  const panels = document.querySelectorAll(".side-panel");
  const buttons = document.querySelectorAll(".icon-btn");

  //--------------------------------------------------------------------
  // Helper: Close all panels EXCEPT a specific one
  //--------------------------------------------------------------------
  function closeAllExcept(exceptPanelId) {
    panels.forEach((p) => {
      if (p.id !== exceptPanelId) p.classList.remove("open");
    });

    buttons.forEach((b) => {
      const t = b.dataset.panel;
      if (`panel-${t}` !== exceptPanelId) b.classList.remove("active");
    });
  }

  function dispatchActivePanel(panelName) {
    document.dispatchEvent(new CustomEvent("activePanelChanged", { detail: { panelName } }));
  }

  window.closePanelsFromCode = function () {
    closeAllExcept(null);
    dispatchActivePanel(null);
  };

  //--------------------------------------------------------------------
  // Exposed function: Called from PoolApp when steps or walls are selected
  //--------------------------------------------------------------------
  window.openPanelFromCode = function (panelName) {
    const panelId = `panel-${panelName}`;
    const panel = document.getElementById(panelId);
    const button = document.querySelector(`.icon-btn[data-panel="${panelName}"]`);

    if (!panel || !button) return;

    closeAllExcept(panelId);

    panel.classList.add("open");
    button.classList.add("active");
    dispatchActivePanel(panelName);

    // Dispatch so PoolApp can animate camera / ghost water, etc.
    if (panelName === "shape") {
      document.dispatchEvent(new CustomEvent("shapePanelOpened"));
    }
    if (panelName === "steps") {
      document.dispatchEvent(new CustomEvent("stepsPanelOpened"));
    }
    if (panelName === "features") {
      document.dispatchEvent(new CustomEvent("featuresPanelOpened"));
    }
    if (panelName === "spa") {
      document.dispatchEvent(new CustomEvent("spaPanelOpened"));
    }
    if (panelName === "assistant") {
      document.dispatchEvent(new CustomEvent("assistantPanelOpened"));
    }
  };

  //--------------------------------------------------------------------
  // UI BUTTON CLICK HANDLERS
  //--------------------------------------------------------------------
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.panel;
      const panelId = `panel-${target}`;
      const panel = document.getElementById(panelId);
      if (!panel) return;

      const isOpen = panel.classList.contains("open");

      // OPENING
      if (!isOpen) {
        closeAllExcept(panelId);
        panel.classList.add("open");
        btn.classList.add("active");
        dispatchActivePanel(target);

        // events
        if (target === "shape") {
          document.dispatchEvent(new CustomEvent("shapePanelOpened"));
        }
        if (target === "steps") {
          document.dispatchEvent(new CustomEvent("stepsPanelOpened"));
        }
        if (target === "features") {
          document.dispatchEvent(new CustomEvent("featuresPanelOpened"));
        }
        if (target === "spa") {
          document.dispatchEvent(new CustomEvent("spaPanelOpened"));
        }
        if (target === "assistant") {
          document.dispatchEvent(new CustomEvent("assistantPanelOpened"));
        }
      }

      // CLOSING
      else {
        panel.classList.remove("open");
        btn.classList.remove("active");
        dispatchActivePanel(null);

        if (target === "shape") {
          document.dispatchEvent(new CustomEvent("shapePanelClosed"));
        }
        if (target === "steps") {
          document.dispatchEvent(new CustomEvent("stepsPanelClosed"));
        }
        if (target === "features") {
          document.dispatchEvent(new CustomEvent("featuresPanelClosed"));
        }
        if (target === "spa") {
          document.dispatchEvent(new CustomEvent("spaPanelClosed"));
        }
        if (target === "assistant") {
          document.dispatchEvent(new CustomEvent("assistantPanelClosed"));
        }
      }
    });
  });

  //--------------------------------------------------------------------
  // STEP UI VISIBILITY (step extension slider)
  //--------------------------------------------------------------------
  const stepExtensionRow = document.getElementById("stepExtensionRow");

  document.addEventListener("stepSelected", () => {
    if (stepExtensionRow) stepExtensionRow.style.display = "block";
  });

  document.addEventListener("stepSelectionCleared", () => {
    if (stepExtensionRow) stepExtensionRow.style.display = "none";
  });

  //--------------------------------------------------------------------
  // WALL UI VISIBILITY (wall raise slider)
  //--------------------------------------------------------------------
  const wallRaiseRow = document.getElementById("wallRaiseRow");
  const wallRaiseSlider = document.getElementById("wallRaise");
  const wallRaiseVal = document.getElementById("wallRaise-val");

  document.addEventListener("wallSelected", () => {
    if (wallRaiseRow) wallRaiseRow.style.display = "block";
    if (wallRaiseSlider) wallRaiseSlider.disabled = false;
  });

  document.addEventListener("wallSelectionCleared", () => {
    if (wallRaiseRow) wallRaiseRow.style.display = "none";

    if (wallRaiseSlider) {
      wallRaiseSlider.disabled = true;
      wallRaiseSlider.value = "0";
    }
    if (wallRaiseVal) wallRaiseVal.textContent = "0.00 m";
  });
}
