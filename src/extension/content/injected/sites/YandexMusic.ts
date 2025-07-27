import { convertTimeToSeconds, getMediaSessionCover } from "../../../../utils/misc";
import { EventError, RatingSystem, Repeat, Site, StateMode } from "../../../types";
import {
  createDefaultControls,
  createSiteInfo,
  notDisabled,
  positionSecondsToPercent,
  ratingUtils,
  setRepeat,
  setStatePlayPauseButton,
} from "../utils";

const YandexMusic: Site = {
  debug: {},
  init: null,
  ready: () => !!navigator.mediaSession.metadata &&  (!!document.querySelector(".player-controls__btn_play") || !!document.querySelector("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label=\"Воспроизведение\"]") || !!document.querySelector("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label=\"Playback\"]") || !!document.querySelector("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label=\"Пауза\"]")) || !!document.querySelector("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label=\"Pause\"]"),
  info: createSiteInfo({
    name: () => "Yandex Music",
    title: () => navigator.mediaSession.metadata?.title ?? "",
    artist: () => navigator.mediaSession.metadata?.artist ?? "",
    album: () => navigator.mediaSession.metadata?.album ?? "",
    cover: () => getMediaSessionCover(),
    state: () => {
      const el = document.querySelector(".player-controls__btn_play") ?? document.querySelector("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label=\"Воспроизведение\"]") ?? document.querySelector("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label=\"Playback\"]") ?? document.querySelector("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label=\"Пауза\"]") ?? document.querySelector("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label=\"Pause\"]");
      if (!el) return StateMode.STOPPED;
      return el.classList.contains("d-icon_play") || el.getAttribute('aria-label') === 'Воспроизведение' || el.getAttribute('aria-label') === 'Playback' ? StateMode.PAUSED : StateMode.PLAYING;
    },
    position: () => convertTimeToSeconds((document.querySelector<HTMLElement>(".progress__bar .progress__left") ?? document.querySelector<HTMLElement>('span[class*="Timecode_root_start"]'))?.innerText ?? "0"),
    duration: () => convertTimeToSeconds((document.querySelector<HTMLElement>(".progress__bar .progress__right") ?? document.querySelector<HTMLElement>('span[class*="Timecode_root_end"]'))?.innerText ?? "0"),
    volume: () => {
      const oldEl: HTMLElement | null = document.querySelector<HTMLElement>(".volume__icon")
      if (oldEl) return oldEl.classList.contains(".volume__icon_mute") ? 0 : 100;
      const el: HTMLInputElement | null = document.querySelector<HTMLInputElement>("input[aria-label=\"Управление громкостью\"]");
      if (el) return el.valueAsNumber*100;
      const endEl: HTMLInputElement | null = document.querySelector<HTMLInputElement>("input[aria-label=\"Manage volume\"]");
      if (endEl) return endEl.valueAsNumber*100;

      return 100;
    },
    rating: () => {
      const oldEl: HTMLElement | null = document.querySelector(".player-controls__track-controls .d-icon_heart-full");
      if (oldEl) return 5;
      const el: HTMLButtonElement | null = document.querySelector<HTMLButtonElement>("div[class*='PlayerBarDesktopWithBackgroundProgressBar_sonata'] button[aria-label=\"Нравится\"]") ?? document.querySelector<HTMLButtonElement>("div[class*='PlayerBarDesktopWithBackgroundProgressBar_sonata'] button[aria-label=\"Like\"]");
      if (el) return el.getAttribute('aria-pressed') === 'true' ? 5 : 0;
      return 0;
    },
    repeat: () => {
      const oldEl = document.querySelector(".player-controls__btn_repeat");
      if (oldEl) {
        if (oldEl.classList.contains("player-controls__btn_repeat_state1")) return Repeat.ALL;
        if (oldEl.classList.contains("player-controls__btn_repeat_state2")) return Repeat.ONE;
      }
      const el = document.querySelector('div[class*="SonataControlsDesktop_buttonContainer"] button[aria-label*="Повтор"]') ?? document.querySelector('div[class*="SonataControlsDesktop_buttonContainer"] button[aria-label*="Repeat"]');
      if (el) {
        if (el.getAttribute('aria-label')?.startsWith('Повтор списка') || el.getAttribute('aria-label')?.startsWith('Repeat playlist')) return Repeat.ALL;
        if (el.getAttribute('aria-label') === 'Повтор трека' || el.getAttribute('aria-label') === 'Repeat track') return Repeat.ONE;
      }

      return Repeat.NONE;
    },
    shuffle: () => {
      const oldEl = document.querySelector(".player-controls__btn_shuffle")
      if (oldEl) return oldEl.classList.contains("player-controls__btn_on") ?? false
      const el = document.querySelector('div[class*="SonataControlsDesktop_buttonContainer"] button[aria-label*="поряд"]') ?? document.querySelector('div[class*="SonataControlsDesktop_buttonContainer"] button[aria-label="Shuffle"]');
      if (el) return el.getAttribute('aria-pressed') === 'true'

      return false;
    },
  }),
  events: {
    setState: (state) => {
      let button = document.querySelector<HTMLButtonElement>(".player-controls__btn_play")
      if (!button) button = document.querySelector("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label=\"Воспроизведение\"]")
      if (!button) button = document.querySelector("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label=\"Playback\"]")
      if (!button) button = document.querySelector("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label=\"Пауза\"]")
      if (!button) button = document.querySelector("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label=\"Pause\"]");
      if (!button) throw new Event("Failed to find button");
      const currentState = YandexMusic.info.state();
      setStatePlayPauseButton(button, currentState, state);
    },
    skipPrevious: () => {
      let button = document.querySelector<HTMLButtonElement>(".d-icon_track-prev");
      if (!button) button = document.querySelector<HTMLButtonElement>("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label*=\"Предыдущ\"]");
      if (!button) button = document.querySelector<HTMLButtonElement>("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label*=\"Prev\"]");
      if (!button) throw new EventError();
      button.click();
    },
    skipNext: () => {
      let button = document.querySelector<HTMLButtonElement>(".d-icon_track-next");
      if (!button) button = document.querySelector<HTMLButtonElement>("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label*=\"Следующ\"]");
      if (!button) button = document.querySelector<HTMLButtonElement>("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label*=\"Next\"]");
      if (!button) throw new EventError();
      button.click();
    },
    setPosition: (seconds) => {
      const percent = positionSecondsToPercent(YandexMusic, seconds);
      const el = document.querySelector(".progress__progress");
      if (!el) throw new EventError();
      const loc = el.getBoundingClientRect();
      const position = percent * loc.width;

      el.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: loc.left + position,
          clientY: loc.top + loc.height / 2,
        }),
      );
      el.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: loc.left + position,
          clientY: loc.top + loc.height / 2,
        }),
      );
    },
    setVolume: (volume) => {
      const currVolume = YandexMusic.info.volume();
      if ((currVolume === 0 && volume > 0) || (currVolume === 100 && volume < 100)) {
        const button = document.querySelector<HTMLButtonElement>(".volume__btn") ?? document.querySelector<HTMLButtonElement>('div[class*="ChangeVolume_root"] button');
        if (!button) throw new EventError();
        button.click();
      }
    },
    setRating: (rating) => {
      ratingUtils.likeDislike(YandexMusic, rating, {
        toggleLike: () => {
          let button = document.querySelector<HTMLButtonElement>(".player-controls__btn .d-icon_heart") ?? document.querySelector<HTMLButtonElement>("div[class*='PlayerBarDesktopWithBackgroundProgressBar_sonata'] button[aria-label=\"Нравится\"]");
          if (!button) button = document.querySelector<HTMLButtonElement>("div[class*='PlayerBarDesktopWithBackgroundProgressBar_sonata'] button[aria-label=\"Like\"]")
          if (!button) throw new EventError();
          button.click();
        },
        toggleDislike: () => {
          let button = document.querySelector<HTMLButtonElement>(".player-controls__btn .d-icon_heart-full") ?? document.querySelector<HTMLButtonElement>("div[class*='PlayerBarDesktopWithBackgroundProgressBar_sonata'] button[aria-label=\"Нравится\"]");
          if (!button) button = document.querySelector<HTMLButtonElement>("div[class*='PlayerBarDesktopWithBackgroundProgressBar_sonata'] button[aria-label=\"Like\"]")
          if (!button) throw new EventError();
          button.click();
        },
      });
    },
    setRepeat: (repeat) => {
      const currentRepeat = YandexMusic.info.repeat();
      if (currentRepeat === repeat) return;
      const button = document.querySelector<HTMLButtonElement>(".player-controls__btn_repeat") ?? document.querySelector<HTMLButtonElement>('div[class*="SonataControlsDesktop_buttonContainer"] button[aria-label*="Повтор"]') ?? document.querySelector('div[class*="SonataControlsDesktop_buttonContainer"] button[aria-label*="Repeat"]');
      if (!button) throw new EventError();

      const repeatMap = {
        [Repeat.NONE]: 0,
        [Repeat.ALL]: 1,
        [Repeat.ONE]: 2,
      };

      setRepeat(button, repeatMap, currentRepeat, repeat);
    },
    setShuffle: (shuffle) => {
      if (YandexMusic.info.shuffle() === shuffle) return;
      let button = document.querySelector<HTMLButtonElement>(".player-controls__btn_shuffle");
      if (!button) button = document.querySelector('div[class*="SonataControlsDesktop_buttonContainer"] button[aria-label*="поряд"]')
      if (!button)  button = document.querySelector('div[class*="SonataControlsDesktop_buttonContainer"] button[aria-label="Shuffle"]')
      if (!button) throw new EventError();
      button.click();
    },
  },
  controls: () =>
    createDefaultControls(YandexMusic, {
      ratingSystem: RatingSystem.LIKE_DISLIKE,
      availableRepeat: Repeat.NONE | Repeat.ALL | Repeat.ONE,
      canSkipPrevious: notDisabled(document.querySelector<HTMLButtonElement>(".d-icon_track-prev") ?? document.querySelector<HTMLButtonElement>("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label*=\"Предыдущ\"]") ?? document.querySelector<HTMLButtonElement>("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label*=\"Prev\"]")),
      canSkipNext: notDisabled(document.querySelector<HTMLButtonElement>(".d-icon_track-next") ?? document.querySelector<HTMLButtonElement>("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label*=\"Следующ\"]") ?? document.querySelector<HTMLButtonElement>("div[class*=\"SonataControlsDesktop_sonataButtons\"] button[aria-label*=\"Next\"]")),
    }),
};

export default YandexMusic;
