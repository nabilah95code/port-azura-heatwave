// The story of Port Azura: five jobs for fixer Dalia Reyes that pay off Milo's
// debt, then an open-ended life of delivery jobs and chop-shop runs. A mission
// is a list of steps; each step names a place, how the player must arrive
// (on foot, in any car, or in one specific car) and what happens on arrival.
import { GARAGE_FEE, START_DEBT } from './config.js';
import { addWanted, distance, spawnCar } from './entities.js';

/** Show a line of dialogue (a phone call or a face-to-face) on the HUD. */
export function say(state, who, text) {
  state.dialogue.push({ who, text, t: 5.2 });
  if (state.dialogue.length > 3) state.dialogue.shift();
}

/** Flash a big centre-screen banner: a job's title, a completion, a warning. */
export function banner(state, title, sub = '') {
  state.banner = { title, sub, t: 3.4 };
}

/** Pay the player, with the sound and the floating text to prove it. */
export function addCash(state, amount, x, y) {
  state.cash += amount;
  state.stats.earned += amount;
  state.audio.cash();
  state.floaters.push({ x: x ?? state.player.x, y: (y ?? state.player.y) - 30, text: `+$${amount}`, color: '#7ee787', life: 1.6 });
}

/** The five story jobs, in order. Points read the landmark table by key. */
export const MISSIONS = [
  {
    title: 'First Errand',
    reward: 250,
    intro: [
      ['Dalia (phone)', "Milo. You owe me two grand, so you're working. My cook at the Coral Diner has a package. Fetch it."],
    ],
    steps: [
      {
        label: 'Pick up the package at the Coral Diner',
        point: (state) => state.city.landmarks.diner,
        radius: 66, mode: 'any',
        onArrive(state) {
          say(state, 'Cook', 'No name, no questions. Just get it to the marina before it gets warm.');
          state.audio.pickup();
        },
      },
      {
        label: 'Deliver the package to Marina Azul',
        point: (state) => state.city.landmarks.marina,
        radius: 76, mode: 'any',
        onArrive(state) {
          say(state, 'Dockhand', 'Dalia\'s? Leave it. She\'ll know it arrived.');
        },
      },
    ],
  },
  {
    title: 'Borrowed Wheels',
    reward: 400,
    intro: [
      ['Dalia (phone)', 'A guest at the Azura Grand left a red coupe outside. Rusty needs it more than he does. Bring it to the yard.'],
    ],
    onStart(state) {
      const hotel = state.city.landmarks.hotel;
      const car = spawnCar(state, 'coupe', hotel.x - 90, hotel.y + 80, 0, null);
      car.color = '#b02040';
      car.missionCar = true;
      car.hp = 260; // The prize of the job: it must survive the trip to Rusty's.
      state.story.targetCar = car;
    },
    steps: [
      {
        label: 'Steal the red coupe at the Azura Grand',
        point: (state) => state.story.targetCar ?? state.city.landmarks.hotel,
        radius: 62, mode: 'thisCar',
        onArrive(state) {
          say(state, 'Dalia (phone)', 'Someone called it in. Move, Milo — and don\'t scratch it.');
          addWanted(state, 1);
        },
      },
      {
        label: "Deliver the coupe to Rusty's Yard",
        point: (state) => state.city.landmarks.rusty,
        radius: 86, mode: 'thisCar',
        onArrive(state) {
          say(state, 'Rusty', 'Clean lines, warm engine. Dalia pays, I don\'t ask.');
          if (state.story.targetCar) state.story.targetCar.missionCar = false;
        },
      },
    ],
  },
  {
    title: 'Hot Pursuit',
    reward: 500,
    intro: [
      ['Dalia (phone)', 'Change of plan — I need a ride myself. Pick me up at the Grand. And Milo? The police may have opinions.'],
    ],
    steps: [
      {
        label: 'Pick up Dalia at the Azura Grand',
        point: (state) => state.city.landmarks.hotel,
        radius: 66, mode: 'any',
        onArrive(state) {
          say(state, 'Dalia', 'Drive. Lose them first, then the Palms Motel. Go!');
          if (state.wanted < 2) addWanted(state, 2 - state.wanted);
          state.story.passenger = true;
        },
      },
      {
        label: 'Take Dalia to the Palms Motel — lose the heat first',
        point: (state) => state.city.landmarks.motel,
        radius: 78, mode: 'car',
        condition: (state) => state.wanted === 0,
        waitingLabel: 'Lose the heat before you reach the Palms Motel',
        onArrive(state) {
          say(state, 'Dalia', 'Not bad, wheelman. Not bad at all.');
          state.story.passenger = false;
        },
      },
    ],
  },
  {
    title: 'Cash Drops',
    reward: 600,
    timer: 185,
    intro: [
      ['Dalia (phone)', 'Three drops around town, one bag each. Collect them all, then the marina. Clock\'s running.'],
    ],
    steps: [
      {
        label: 'Collect the drop at Sunset Garage',
        point: (state) => state.city.landmarks.garage,
        radius: 58, mode: 'any',
        onArrive(state) { state.audio.pickup(); say(state, 'Milo', 'One. Two to go.'); },
      },
      {
        label: 'Collect the drop at the Old Pier',
        point: (state) => state.city.landmarks.pier,
        radius: 58, mode: 'any',
        onArrive(state) { state.audio.pickup(); say(state, 'Milo', 'Two. One more.'); },
      },
      {
        label: 'Collect the drop at Azura General',
        point: (state) => state.city.landmarks.hospital,
        radius: 58, mode: 'any',
        onArrive(state) { state.audio.pickup(); say(state, 'Milo', 'All three. Marina, now.'); },
      },
      {
        label: 'Take the cash to Marina Azul',
        point: (state) => state.city.landmarks.marina,
        radius: 76, mode: 'any',
        onArrive(state) { say(state, 'Dockhand', 'Dalia says your tab is nearly clean, Vane.'); },
      },
    ],
  },
  {
    title: 'The Payoff',
    reward: 250,
    intro: [
      ['Dalia (phone)', 'Last one. Bring yourself to the Coral Diner and we settle the books — in person.'],
    ],
    steps: [
      {
        label: 'Meet Dalia at the Coral Diner',
        point: (state) => state.city.landmarks.diner,
        radius: 66, mode: 'any',
        onArrive(state) {
          say(state, 'Dalia', 'Two grand, paid in sweat. We\'re square, Milo.');
          say(state, 'Dalia', '...That\'s not my car outside. That\'s PAPD. RUN.');
          if (state.wanted < 3) addWanted(state, 3 - state.wanted);
        },
      },
      {
        label: 'Lose the heat',
        point: () => null,
        radius: 0, mode: 'any',
        condition: (state) => state.wanted === 0,
        onArrive(state) {
          say(state, 'Dalia (phone)', 'Square and free. The city\'s yours now — work when you want. Rusty always pays for clean cars.');
        },
      },
    ],
  },
];

/** Begin the story state: between jobs, with a short breather before job one. */
export function createStory() {
  return {
    index: 0,
    step: 0,
    active: false,
    breather: 2.5,
    timer: null,
    targetCar: null,
    passenger: false,
    done: false,
    sideJob: null,
    sideJobTimer: 14,
  };
}

/** Start the current mission: banner, intro dialogue, its onStart hook. */
function startMission(state) {
  const story = state.story;
  const mission = MISSIONS[story.index];
  story.active = true;
  story.step = 0;
  story.timer = mission.timer ?? null;
  if (mission.onStart) mission.onStart(state);
  banner(state, `Job ${story.index + 1}: ${mission.title}`, `Reward $${mission.reward}`);
  for (const [who, text] of mission.intro) say(state, who, text);
  refreshObjective(state);
}

/** Fail the current mission (its timer ran out) and queue a retry. */
function failMission(state) {
  const story = state.story;
  banner(state, 'Job failed', 'Dalia is not pleased. She will call again.');
  state.audio.fail();
  story.active = false;
  story.breather = 6;
  story.timer = null;
  state.objective = null;
}

/** Finish the current mission: pay out, celebrate, queue the next one. */
function completeMission(state) {
  const story = state.story;
  const mission = MISSIONS[story.index];
  addCash(state, mission.reward);
  state.audio.complete();
  banner(state, 'Job complete', `${mission.title} — $${mission.reward}`);
  story.active = false;
  story.timer = null;
  state.objective = null;
  story.index += 1;
  const repaid = MISSIONS.slice(0, story.index).reduce((sum, m) => sum + m.reward, 0);
  state.debt = Math.max(0, START_DEBT - repaid);
  if (story.index >= MISSIONS.length) {
    story.done = true;
    state.debt = 0;
    banner(state, 'Debt paid — story complete', 'Port Azura is yours: deliveries and Rusty\'s yard pay forever.');
  } else {
    story.breather = 7;
  }
  state.requestSave = true;
}

/** Point the HUD objective at the current step (or side job). */
export function refreshObjective(state) {
  const story = state.story;
  if (story.active) {
    const mission = MISSIONS[story.index];
    const step = mission.steps[story.step];
    const point = step.point(state);
    state.objective = point
      ? { x: point.x, y: point.y, label: step.label, radius: step.radius }
      : { x: 0, y: 0, label: step.label, radius: 0, hidden: true };
  } else if (story.sideJob) {
    const job = story.sideJob;
    const point = job.phase === 'pickup' ? job.from : job.to;
    state.objective = {
      x: point.x, y: point.y,
      label: job.phase === 'pickup' ? `Pick up a parcel at ${job.from.name}` : `Deliver to ${job.to.name} — $${job.pay}`,
      radius: job.phase === 'pickup' ? 60 : 76,
    };
  } else {
    state.objective = null;
  }
}

/** Has the player satisfied this step's arrival rule? */
function stepArrived(state, step) {
  const player = state.player;
  if (step.mode === 'thisCar' && player.car !== state.story.targetCar) return false;
  if (step.mode === 'car' && !player.car) return false;
  if (step.mode === 'foot' && player.car) return false;
  if (step.condition && !step.condition(state)) return false;
  const point = step.point(state);
  if (!point) return step.condition ? step.condition(state) : false;
  return distance(player.x, player.y, point.x, point.y) < step.radius;
}

/** Advance the story one tick: timers, arrivals, side jobs, the chop shop. */
export function updateMissions(state, dt) {
  const story = state.story;
  const player = state.player;

  if (!story.active && !story.done) {
    story.breather -= dt;
    if (story.breather <= 0) startMission(state);
  }

  if (story.active) {
    const mission = MISSIONS[story.index];
    if (story.timer !== null) {
      story.timer -= dt;
      if (story.timer <= 0) {
        failMission(state);
        return;
      }
    }
    const step = mission.steps[story.step];
    if (stepArrived(state, step)) {
      if (step.onArrive) step.onArrive(state);
      story.step += 1;
      if (story.step >= mission.steps.length) completeMission(state);
      else refreshObjective(state);
    } else if (step.waitingLabel && step.condition && !step.condition(state)) {
      if (state.objective) state.objective.label = step.waitingLabel;
    } else if (state.objective) {
      state.objective.label = step.label;
    }
  }

  // Free-roam work once the story is done: endless delivery jobs.
  if (story.done && !story.active) {
    if (!story.sideJob) {
      story.sideJobTimer -= dt;
      if (story.sideJobTimer <= 0) {
        const keys = Object.keys(state.city.landmarks).filter((k) => k !== 'pier' && k !== 'beachbar');
        const from = state.city.landmarks[state.rng.pick(keys)];
        let to = state.city.landmarks[state.rng.pick(keys)];
        if (to === from) to = state.city.landmarks.diner;
        const pay = Math.round(80 + distance(from.x, from.y, to.x, to.y) / 14);
        story.sideJob = { from, to, pay, phase: 'pickup' };
        say(state, 'Dalia (phone)', `Small work if you want it: a parcel at ${from.name}, wanted at ${to.name}. $${pay}.`);
        refreshObjective(state);
      }
    } else {
      const job = story.sideJob;
      const point = job.phase === 'pickup' ? job.from : job.to;
      const radius = job.phase === 'pickup' ? 60 : 76;
      if (distance(state.player.x, state.player.y, point.x, point.y) < radius) {
        if (job.phase === 'pickup') {
          job.phase = 'deliver';
          state.audio.pickup();
        } else {
          addCash(state, job.pay, point.x, point.y);
          story.sideJob = null;
          story.sideJobTimer = state.rng.range(16, 30);
          state.objective = null;
        }
        refreshObjective(state);
      }
    }
  }

  // Sunset Garage: hold still inside with heat on and $150 buys fresh plates.
  const garage = state.city.landmarks.garage;
  state.nearGarage = player.car && state.wanted > 0 && distance(player.x, player.y, garage.x, garage.y) < 88;
  if (state.nearGarage) {
    const speed = Math.hypot(player.car.vx, player.car.vy);
    if (speed < 26 && state.cash >= GARAGE_FEE) {
      state.garageDwell = (state.garageDwell ?? 0) + dt;
      if (state.garageDwell > 1.4) {
        state.garageDwell = 0;
        state.cash -= GARAGE_FEE;
        state.wanted = 0;
        state.wantedCalm = 0;
        banner(state, 'Fresh plates', `Sunset Garage — $${GARAGE_FEE}. The heat forgets your car.`);
        state.audio.complete();
        state.events.push({ type: 'heatLost' });
      }
    } else {
      state.garageDwell = 0;
    }
  } else {
    state.garageDwell = 0;
  }

  // Rusty's standing offer: any car the player stole, delivered, pays $60.
  if (player.car && player.car.stolenValue && !player.car.missionCar) {
    const rusty = state.city.landmarks.rusty;
    if (distance(player.x, player.y, rusty.x, rusty.y) < 88) {
      const value = player.car.stolenValue;
      player.car.stolenValue = 0;
      addCash(state, value, rusty.x, rusty.y);
      say(state, 'Rusty', 'Another one? You\'re my favourite felon, Vane.');
    }
  }
}
