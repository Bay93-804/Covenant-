/**
 * Sound + vibration feedback for timer completion. Every call is wrapped in
 * try/catch: haptics/audio are a nice-to-have completion cue, never a
 * reason to break the workout player (e.g. haptics are unsupported on web,
 * and a device with silent mode / no speaker must not throw).
 */
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

const timerCompleteSound = require('../../../assets/sounds/timer-complete.wav');
const restTimerCompleteSound = require('../../../assets/sounds/rest-timer-complete.wav');

let timerPlayer: AudioPlayer | null = null;
let restPlayer: AudioPlayer | null = null;

function getPlayer(kind: 'timer' | 'rest'): AudioPlayer | null {
  try {
    if (kind === 'timer') {
      if (!timerPlayer) timerPlayer = createAudioPlayer(timerCompleteSound);
      return timerPlayer;
    }
    if (!restPlayer) restPlayer = createAudioPlayer(restTimerCompleteSound);
    return restPlayer;
  } catch (error) {
    console.warn('[timers] could not create audio player:', error);
    return null;
  }
}

async function playSound(kind: 'timer' | 'rest'): Promise<void> {
  try {
    const player = getPlayer(kind);
    if (!player) return;
    await player.seekTo(0);
    player.play();
  } catch (error) {
    console.warn('[timers] sound feedback failed (non-fatal):', error);
  }
}

async function vibrate(): Promise<void> {
  if (Platform.OS === 'web') return; // expo-haptics has no web implementation
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    console.warn('[timers] haptic feedback failed (non-fatal):', error);
  }
}

/** Rest timer hitting zero — a slightly more prominent cue since it means "get back to work". */
export async function playRestTimerCompleteFeedback(): Promise<void> {
  await Promise.all([playSound('rest'), vibrate()]);
}

/** A generic exercise/run timer finishing (e.g. a timed hold, an interval). */
export async function playTimerCompleteFeedback(): Promise<void> {
  await Promise.all([playSound('timer'), vibrate()]);
}

export async function playLightTap(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (error) {
    console.warn('[timers] light haptic tap failed (non-fatal):', error);
  }
}
