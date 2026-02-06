import { getMediaSessionCover } from "../../../../utils/misc";
import { EventError, RatingSystem, Repeat, Site, StateMode } from "../../../types";
import {
  createDefaultControls,
  createSiteInfo,
  notDisabled,
  setStatePlayPauseButton,
} from "../utils";

/**
 * Selectors for Zvuk.com player.
 * Supports both mini-player and expanded (maxi) player modes.
 * Classes are CSS modules: ComponentName_className__hash - we match only stable prefix.
 */
const Selectors = {
  // Player container
  playerWrapper: '[class*="miniPlayerWrapper"]',
  playerContainer: '[class*="playerContainer"]',
  // Maxi player indicator
  maxiPlayerActive: '[class*="miniPlayerWrapperActive"]',

  // Track info (mini player)
  coverImage: '[class*="coverButton"] img',
  trackTitle: '[class*="infoTitle"] p',
  artistName: '[class*="artistsWrapper"] a p',

  // Track info (maxi player) - larger cover in styles_left__
  maxiCoverImage: '[class*="styles_imageWrapper"] img',
  maxiTrackTitle: '[class*="styles_titleLink"] p',
  maxiArtistName: '[class*="styles_artistsWrapper__"] a p',

  // Controls container - works in both modes
  // Mini player: styles_controls__ inside styles_actions__
  // Maxi player: styles_controls__ inside styles_controlsWrapper__
  controlsContainer: '[class*="styles_controls__"]',

  // Add/Like button
  addButton: '[class*="btnAdd"]',

  // Progress bar (mini player)
  progressBar: '[class*="styles_bar__"]',
  progressInner: '[class*="styles_inner__"]',

  // Time display (maxi player only) - shows "1:23" and "-2:40"
  timeContainer: '[class*="styles_time__"]',

  // Volume slider - aria attribute is stable
  volumeSlider: '[role="slider"][aria-valuetext^="Громкость"]',

  // Shuffle and Repeat
  shuffleButton: 'button:has([class*="shuffleIcon"])',
  repeatButton: 'button:has([class*="repeatIcon"])',
};

/**
 * Parse time string "M:SS" to seconds.
 */
function parseTimeToSeconds(timeStr: string): number {
  const cleaned = timeStr.replace("-", "").trim();
  const parts = cleaned.split(":");
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseInt(parts[1], 10) || 0;
    return minutes * 60 + seconds;
  }
  return 0;
}

/**
 * Get current position and duration from maxi player time display.
 * Format: "1:23" (current) and "-2:40" (remaining)
 */
function getTimeInfo(): { position: number; duration: number } {
  const container = document.querySelector(Selectors.timeContainer);
  if (!container) return { position: 0, duration: 0 };

  const spans = container.querySelectorAll("span");
  if (spans.length < 2) return { position: 0, duration: 0 };

  const currentText = spans[0]?.textContent || "";
  const remainingText = spans[1]?.textContent || "";

  const position = parseTimeToSeconds(currentText);
  const remaining = parseTimeToSeconds(remainingText);
  const duration = position + remaining;

  return { position, duration };
}

/**
 * Get volume from slider aria-valuenow attribute.
 * Returns volume as number (0-100).
 */
function getVolume(): number {
  const slider = document.querySelector<HTMLElement>(Selectors.volumeSlider);
  if (!slider) return 100;
  const value = slider.getAttribute("aria-valuenow");
  return value ? parseFloat(value) : 100;
}

/**
 * Find play/pause button in controls container.
 * Second button in the controls div.
 */
function getPlayPauseButton(): HTMLButtonElement | null {
  const containers = Array.from(document.querySelectorAll(Selectors.controlsContainer));
  for (const container of containers) {
    const buttons = container.querySelectorAll("button");
    if (buttons.length >= 2) {
      return buttons[1] as HTMLButtonElement;
    }
  }
  return null;
}

/**
 * Find prev button - first button in controls.
 */
function getPrevButton(): HTMLButtonElement | null {
  const containers = Array.from(document.querySelectorAll(Selectors.controlsContainer));
  for (const container of containers) {
    const buttons = container.querySelectorAll("button");
    if (buttons.length >= 1) {
      return buttons[0] as HTMLButtonElement;
    }
  }
  return null;
}

/**
 * Find next button - last button in controls.
 */
function getNextButton(): HTMLButtonElement | null {
  const containers = Array.from(document.querySelectorAll(Selectors.controlsContainer));
  for (const container of containers) {
    const buttons = container.querySelectorAll("button");
    if (buttons.length >= 3) {
      return buttons[2] as HTMLButtonElement;
    }
  }
  return null;
}

/**
 * Check if play/pause button shows pause icon (i.e., currently playing).
 * Pause icon contains two vertical rectangles.
 */
function isPlaying(): boolean {
  const button = getPlayPauseButton();
  if (!button) return false;

  const svg = button.querySelector("svg");
  if (!svg) return false;

  const paths = Array.from(svg.querySelectorAll("path"));
  for (const path of paths) {
    const d = path.getAttribute("d") || "";
    // Pause icon patterns (two vertical bars)
    // Mini: M8.25 3.09v13.82 ... m7.358
    // Maxi: M11.549 4.326v19.348 ... m10.301
    if (d.includes("M8.25 3.09") || d.includes("M11.549 4.326")) {
      return true;
    }
  }
  return false;
}

/**
 * Check if shuffle is active.
 */
function isShuffleActive(): boolean {
  const button = document.querySelector<HTMLButtonElement>(Selectors.shuffleButton);
  if (!button) return false;
  // Active state indicated by aria-pressed or specific class
  return button.getAttribute("aria-pressed") === "true" || button.querySelector('[class*="activeIcon"]') !== null;
}

/**
 * Check repeat state.
 */
function getRepeatState(): Repeat {
  const button = document.querySelector<HTMLButtonElement>(Selectors.repeatButton);
  if (!button) return Repeat.NONE;
  
  const activeIcon = button.querySelector('[class*="activeIcon"]');
  if (!activeIcon) return Repeat.NONE;
  
  // Check if it's "repeat one" mode (usually has a "1" indicator or different icon)
  const hasOneIndicator = button.textContent?.includes("1") || 
    button.querySelector('[class*="repeatOne"]') !== null;
  
  if (hasOneIndicator) return Repeat.ONE;
  return Repeat.ALL;
}

const Zvuk: Site = {
  debug: {},
  init: null,
  ready: () => {
    // Check if player is visible, has track info, AND controls are available
    const player = document.querySelector(Selectors.playerWrapper);
    const trackTitle = document.querySelector(Selectors.trackTitle);
    const controls = document.querySelector(Selectors.controlsContainer);
    return !!player && !!trackTitle && !!controls;
  },
  info: createSiteInfo({
    name: () => "Zvuk",
    title: () => {
      // Try mediaSession first
      if (navigator.mediaSession.metadata?.title) {
        return navigator.mediaSession.metadata.title;
      }
      // Fallback to DOM
      const titleEl = document.querySelector<HTMLElement>(Selectors.trackTitle);
      return titleEl?.textContent?.trim() ?? "";
    },
    artist: () => {
      // Try mediaSession first
      if (navigator.mediaSession.metadata?.artist) {
        return navigator.mediaSession.metadata.artist;
      }
      // Fallback to DOM - collect all artists
      const artistEls = document.querySelectorAll<HTMLElement>(Selectors.artistName);
      const artists: string[] = [];
      artistEls.forEach((el) => {
        const text = el.textContent?.trim();
        if (text) artists.push(text);
      });
      return artists.join(", ");
    },
    album: () => {
      // mediaSession might have album info
      return navigator.mediaSession.metadata?.album ?? "";
    },
    cover: () => {
      // Try mediaSession first
      const mediaSessionCover = getMediaSessionCover();
      if (mediaSessionCover) return mediaSessionCover;
      
      // Fallback to DOM
      const img = document.querySelector<HTMLImageElement>(Selectors.coverImage);
      if (!img) return "";
      
      // Get the largest image from srcset or src
      const srcset = img.getAttribute("srcset");
      if (srcset) {
        // Parse srcset and get largest version (xlarge or large)
        const sources = srcset.split(",").map(s => s.trim());
        for (const source of sources.reverse()) {
          if (source.includes("xlarge") || source.includes("large")) {
            const url = source.split(" ")[0];
            return url.replace(/&amp;/g, "&");
          }
        }
      }
      return img.src?.replace(/&amp;/g, "&") ?? "";
    },
    state: () => {
      const player = document.querySelector(Selectors.playerWrapper);
      if (!player) return StateMode.STOPPED;
      return isPlaying() ? StateMode.PLAYING : StateMode.PAUSED;
    },
    position: () => {
      // Maxi player shows time in "M:SS" / "-M:SS" format
      const { position } = getTimeInfo();
      return position;
    },
    duration: () => {
      // Maxi player shows remaining time, calculate total
      const { duration } = getTimeInfo();
      return duration;
    },
    volume: () => getVolume(),
    rating: () => {
      // Check if track is added/liked
      const addBtn = document.querySelector<HTMLButtonElement>(Selectors.addButton);
      if (!addBtn) return 0;
      // If the button shows a "check" or filled icon, track is liked
      const svg = addBtn.querySelector("svg");
      if (svg) {
        const paths = Array.from(svg.querySelectorAll("path"));
        for (const path of paths) {
          const d = path.getAttribute("d") || "";
          // Check for "check" or "minus" pattern indicating it's already added
          if (d.includes("check") || d.includes("M10 2.292c2.059")) {
            // This is the circled plus icon, not liked
            return 0;
          }
        }
      }
      return 0;
    },
    repeat: () => getRepeatState(),
    shuffle: () => isShuffleActive(),
  }),
  events: {
    setState: (state) => {
      const button = getPlayPauseButton();
      if (!button) throw new EventError();

      const currentState = Zvuk.info.state();
      setStatePlayPauseButton(button, currentState, state);
    },
    skipPrevious: () => {
      const button = getPrevButton();
      if (!button) throw new EventError();
      button.click();
    },
    skipNext: () => {
      const button = getNextButton();
      if (!button) throw new EventError();
      button.click();
    },
    setPosition: (seconds) => {
      // Zvuk uses a div-based progress bar, simulate drag like volume slider
      const progressBar = document.querySelector<HTMLElement>(Selectors.progressBar);
      if (!progressBar) throw new EventError();

      const duration = Zvuk.info.duration();
      if (duration === 0) return; // Can't seek without knowing duration

      const percent = Math.max(0, Math.min(1, seconds / duration));
      const rect = progressBar.getBoundingClientRect();
      const clickX = rect.left + rect.width * percent;
      const clickY = rect.top + rect.height / 2;

      // Use same pattern as volume slider: mousedown + mouseup
      progressBar.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: clickX,
          clientY: clickY,
        })
      );
      progressBar.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: clickX,
          clientY: clickY,
        })
      );
    },
    setVolume: (volume) => {
      const slider = document.querySelector<HTMLElement>(Selectors.volumeSlider);
      if (!slider) throw new EventError();
      
      // Simulate drag on volume slider
      const rect = slider.getBoundingClientRect();
      const percent = volume / 100;
      const clickX = rect.left + rect.width * percent;
      const clickY = rect.top + rect.height / 2;
      
      slider.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: clickX,
          clientY: clickY,
        })
      );
      slider.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: clickX,
          clientY: clickY,
        })
      );
    },
    setRating: () => {
      // Toggle like/add button
      const button = document.querySelector<HTMLButtonElement>(Selectors.addButton);
      if (!button) throw new EventError();
      button.click();
    },
    setRepeat: (repeat) => {
      const currentRepeat = Zvuk.info.repeat();
      if (currentRepeat === repeat) return;
      
      const button = document.querySelector<HTMLButtonElement>(Selectors.repeatButton);
      if (!button) throw new EventError();
      
      // Cycle through repeat states until we reach desired one
      // NONE -> ALL -> ONE -> NONE
      const states = [Repeat.NONE, Repeat.ALL, Repeat.ONE];
      let currentIndex = states.indexOf(currentRepeat);
      const targetIndex = states.indexOf(repeat);
      
      while (currentIndex !== targetIndex) {
        button.click();
        currentIndex = (currentIndex + 1) % 3;
      }
    },
    setShuffle: (shuffle) => {
      if (Zvuk.info.shuffle() === shuffle) return;
      
      const button = document.querySelector<HTMLButtonElement>(Selectors.shuffleButton);
      if (!button) throw new EventError();
      button.click();
    },
  },
  controls: () => {
    const shuffleBtn = document.querySelector<HTMLButtonElement>(Selectors.shuffleButton);
    const repeatBtn = document.querySelector<HTMLButtonElement>(Selectors.repeatButton);
    
    return createDefaultControls(Zvuk, {
      ratingSystem: RatingSystem.LIKE,
      availableRepeat: Repeat.NONE | Repeat.ALL | Repeat.ONE,
      canSkipPrevious: notDisabled(getPrevButton()),
      canSkipNext: notDisabled(getNextButton()),
      canSetPosition: Zvuk.info.duration() > 0, // Only in maxi mode when time is visible
      canSetShuffle: notDisabled(shuffleBtn),
      canSetRepeat: notDisabled(repeatBtn),
    });
  },
};

export default Zvuk;
