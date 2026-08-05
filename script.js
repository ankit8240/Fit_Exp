class FitExpSystem {
  constructor() {
    this.storageKey = 'fitExpSystemV1';
    this.today = this.dateKey();
    this.sessionSeconds = 0;
    this.timerInterval = null;
    this.toastTimeout = null;
    this.state = this.loadState();
    this.cacheElements();
    this.bindOnboarding();

    if (!this.state.profile) {
      this.showOnboarding();
      return;
    }
    this.startSystem();
  }

  defaultState() {
    return {
      version: 1, profile: null, difficulty: null, level: 1, exp: 0, expToNextLevel: 100,
      coins: 0, rewardMultiplier: 1, streak: 0, lastCompletedDate: null, day: this.today,
      missions: [], completed: {}, claimed: false, water: 0, focusSeconds: 0, achievements: {},
      history: {}, inventory: [], activityLog: [], settings: { lightMode: false, soundsMuted: false }
    };
  }

  loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey));
      return { ...this.defaultState(), ...saved, settings: { ...this.defaultState().settings, ...(saved?.settings || {}) } };
    } catch {
      return this.defaultState();
    }
  }

  save() { localStorage.setItem(this.storageKey, JSON.stringify(this.state)); }

  cacheElements() {
    this.el = {
      onboarding: document.getElementById('onboarding'), app: document.getElementById('app-shell'),
      profileForm: document.getElementById('profile-form'), experienceForm: document.getElementById('experience-form'),
      onboardingTitle: document.getElementById('onboarding-title'), onboardingDescription: document.getElementById('onboarding-description'),
      profileNameInput: document.getElementById('profile-name-input'), profileGenderInput: document.getElementById('profile-gender-input'), profileAgeInput: document.getElementById('profile-age-input'),
      taskList: document.getElementById('task-list'), exp: document.getElementById('player-exp'), nextExp: document.getElementById('next-level-exp'),
      level: document.getElementById('player-level'), streak: document.getElementById('player-streak'), coins: document.getElementById('fit-coins'), multiplier: document.getElementById('reward-multiplier'),
      expProgress: document.getElementById('exp-progress'), completed: document.getElementById('completed-count'), total: document.getElementById('total-count'),
      questCount: document.getElementById('quest-count'), hint: document.getElementById('mission-hint'), claim: document.getElementById('claim-reward'),
      consistency: document.getElementById('consistency-value'), consistencyProgress: document.getElementById('consistency-progress'),
      water: document.getElementById('water-count'), waterFill: document.getElementById('water-fill'), focusTotal: document.getElementById('focus-total'),
      timer: document.getElementById('timer-display'), timerToggle: document.getElementById('timer-toggle'), timerPanel: document.querySelector('.timer-panel'),
      toast: document.getElementById('notification'), toastText: document.querySelector('.notification-text'), chart: document.getElementById('weekly-chart'),
      guideModal: document.getElementById('guide-modal'), guideCategory: document.getElementById('guide-category'), guideTitle: document.getElementById('guide-title'),
      guideIntro: document.getElementById('guide-intro'), guideSteps: document.getElementById('guide-steps'), guideTip: document.getElementById('guide-tip'),
      guideSafety: document.getElementById('guide-safety'), guideClose: document.getElementById('close-guide'),
      activityLog: document.getElementById('activity-log'), logFilter: document.getElementById('log-filter'), achievementCount: document.getElementById('achievement-count'),
      playerName: document.getElementById('player-name-display'), profileName: document.getElementById('profile-name'), profileInitial: document.getElementById('profile-initial'),
      profileMeta: document.getElementById('profile-meta'), planLabel: document.getElementById('plan-label'), missionIntro: document.getElementById('mission-intro'),
      missionDate: document.getElementById('mission-date'), dailyDirective: document.getElementById('daily-directive'), latestReward: document.getElementById('latest-reward'),
      inventoryCount: document.getElementById('inventory-count'), inventoryList: document.getElementById('inventory-list'), daysCompleted: document.getElementById('days-completed'),
      lifetimeFocus: document.getElementById('lifetime-focus'), recordCount: document.getElementById('record-count')
    };
  }

  bindOnboarding() {
    this.el.profileForm.addEventListener('submit', event => {
      event.preventDefault();
      const name = this.el.profileNameInput.value.trim();
      const age = Number(this.el.profileAgeInput.value);
      const gender = this.el.profileGenderInput.value;
      if (!name || !gender || age < 13 || age > 100) return;
      this.pendingProfile = { name, gender, age };
      this.el.profileForm.hidden = true;
      this.el.experienceForm.hidden = false;
      this.el.onboardingTitle.textContent = 'Choose your starting point.';
      this.el.onboardingDescription.textContent = 'FIT EXP will set daily missions that match your current routine.';
    });

    document.getElementById('back-to-profile').addEventListener('click', () => {
      this.el.profileForm.hidden = false;
      this.el.experienceForm.hidden = true;
      this.el.onboardingTitle.textContent = 'Build your training profile.';
      this.el.onboardingDescription.textContent = 'Your plan, progress and activity records are stored privately on this device.';
    });

    this.el.experienceForm.addEventListener('submit', event => {
      event.preventDefault();
      const difficulty = new FormData(this.el.experienceForm).get('experience');
      if (!difficulty || !this.pendingProfile) return;
      this.state = this.defaultState();
      this.state.profile = this.pendingProfile;
      this.state.difficulty = difficulty;
      this.state.day = this.today;
      this.state.missions = this.createDailyMissions(difficulty, this.today);
      this.logActivity('system', 'Profile activated', this.pendingProfile.name + ' selected the ' + this.difficultyName(difficulty) + ' plan.');
      this.updateDayRecord();
      this.save();
      this.startSystem();
      this.el.onboarding.hidden = true;
      this.el.app.hidden = false;
      this.showToast('Welcome, ' + this.state.profile.name + '. Your plan is ready.');
    });
  }

  showOnboarding() {
    this.el.onboarding.hidden = false;
    this.el.app.hidden = true;
    setTimeout(() => this.el.profileNameInput.focus(), 100);
  }

  startSystem() {
    this.ensureToday();
    document.body.classList.toggle('light-mode', this.state.settings.lightMode);
    document.getElementById('sound-toggle').textContent = this.state.settings.soundsMuted ? '\u2669' : '\u266B';
    this.bindSystemEvents();
    this.render();
    this.startClock();
    this.el.onboarding.hidden = true;
    this.el.app.hidden = false;
  }

  bindSystemEvents() {
    this.el.taskList.addEventListener('change', event => {
      if (event.target.matches('input[type="checkbox"]')) this.toggleMission(event.target);
    });
    this.el.taskList.addEventListener('click', event => {
      const instructionButton = event.target.closest('.instruction-button');
      if (!instructionButton) return;
      event.preventDefault();
      event.stopPropagation();
      const mission = this.state.missions.find(entry => entry.id === instructionButton.dataset.taskId);
      if (mission) this.openExerciseGuide(mission);
    });
    this.el.claim.addEventListener('click', () => this.claimReward());
    document.getElementById('water-plus').addEventListener('click', () => this.logWater(1));
    document.getElementById('water-minus').addEventListener('click', () => this.logWater(-1));
    this.el.timerToggle.addEventListener('click', () => this.toggleTimer());
    document.getElementById('timer-reset').addEventListener('click', () => this.resetTimer());
    document.getElementById('sound-toggle').addEventListener('click', event => {
      this.state.settings.soundsMuted = !this.state.settings.soundsMuted;
      event.currentTarget.textContent = this.state.settings.soundsMuted ? '\u2669' : '\u266B';
      this.logActivity('system', 'Sound setting changed', this.state.settings.soundsMuted ? 'System sounds muted.' : 'System sounds enabled.');
      this.save();
      this.showToast(this.state.settings.soundsMuted ? 'System sounds muted.' : 'System sounds active.');
      this.renderLogs();
    });
    document.getElementById('theme-toggle').addEventListener('click', () => {
      this.state.settings.lightMode = !this.state.settings.lightMode;
      document.body.classList.toggle('light-mode', this.state.settings.lightMode);
      this.logActivity('system', 'Interface changed', this.state.settings.lightMode ? 'Light interface activated.' : 'Dark interface activated.');
      this.save();
      this.showToast(this.state.settings.lightMode ? 'Light interface activated.' : 'Dark interface activated.');
      this.renderLogs();
    });
    document.getElementById('reset-progress').addEventListener('click', () => {
      if (confirm('Reset the profile, activity log, rewards and all locally stored records?')) {
        localStorage.removeItem(this.storageKey);
        location.reload();
      }
    });
    this.el.logFilter.addEventListener('change', () => this.renderLogs());
    document.getElementById('export-records').addEventListener('click', () => this.exportRecords());
    this.el.guideClose.addEventListener('click', () => this.closeExerciseGuide());
    this.el.guideModal.addEventListener('click', event => {
      if (event.target === this.el.guideModal) this.closeExerciseGuide();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !this.el.guideModal.hidden) this.closeExerciseGuide();
    });
  }

  dateKey(offset = 0) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    return date.toLocaleDateString('en-CA');
  }

  daysFromStart(date) {
    const target = new Date(date + 'T12:00:00');
    const start = new Date('2025-01-01T12:00:00');
    return Math.floor((target - start) / 86400000);
  }

  daysBetween(firstDate, secondDate) {
    return Math.max(0, this.daysFromStart(secondDate) - this.daysFromStart(firstDate));
  }

  missionLibrary() {
    return {
      beginner: [
        ['Step out for a 10-minute walk', 'Cardio · easy start', 'W', 20], ['10 Chair squats', 'Lower body · controlled', 'S', 20],
        ['8 Wall push-ups', 'Upper body · beginner', 'P', 20], ['30-second standing march', 'Cardio · gentle pace', 'M', 15],
        ['5 minutes of mobility', 'Recovery · full body', 'R', 15], ['20-second plank', 'Core · beginner', 'C', 20],
        ['12 Glute bridges', 'Lower body · stability', 'G', 20], ['10-minute easy stretch', 'Recovery · flexibility', 'F', 15],
        ['12 Calf raises', 'Lower body · balance', 'B', 15]
      ],
      medium: [
        ['25 Push-ups', 'Strength · upper body', 'P', 35], ['35 Bodyweight squats', 'Strength · lower body', 'S', 35],
        ['60-second plank', 'Core · endurance', 'C', 35], ['15-minute brisk walk', 'Cardio · steady pace', 'W', 30],
        ['20 Reverse lunges', 'Lower body · balance', 'L', 35], ['12-minute mobility flow', 'Recovery · movement', 'R', 25],
        ['20 Mountain climbers', 'Cardio · core', 'M', 35], ['15 Glute bridges', 'Posterior chain · control', 'G', 30],
        ['30 Jumping jacks', 'Cardio · energy', 'J', 30]
      ],
      advanced: [
        ['50 Push-ups', 'Strength · upper body', 'P', 50], ['75 Bodyweight squats', 'Strength · lower body', 'S', 50],
        ['2-minute plank', 'Core · endurance', 'C', 50], ['25-minute cardio session', 'Cardio · focused pace', 'W', 45],
        ['40 Alternating lunges', 'Lower body · balance', 'L', 50], ['20 Burpees', 'Conditioning · high effort', 'B', 55],
        ['40 Mountain climbers', 'Cardio · core', 'M', 50], ['20-minute mobility work', 'Recovery · durability', 'R', 35],
        ['60 Jumping jacks', 'Cardio · power', 'J', 45], ['30 Glute bridges', 'Posterior chain · control', 'G', 40]
      ]
    };
  }

  createDailyMissions(difficulty, date) {
    const pool = this.missionLibrary()[difficulty];
    const count = difficulty === 'advanced' ? 4 : 3;
    const seed = this.daysFromStart(date);
    const indexes = [];
    for (let index = 0; indexes.length < count; index += 1) {
      const candidate = (seed * 3 + index * 2 + (difficulty === 'advanced' ? 1 : 0)) % pool.length;
      if (!indexes.includes(candidate)) indexes.push(candidate);
    }
    return indexes.map((index, position) => {
      const entry = pool[index];
      return { id: date + '-' + difficulty + '-' + index + '-' + position, title: entry[0], subtitle: entry[1], icon: entry[2], baseXp: entry[3] };
    });
  }

  ensureToday() {
    if (this.state.day === this.today) {
      if (!this.state.missions.length) this.state.missions = this.createDailyMissions(this.state.difficulty, this.today);
      return;
    }

    const total = this.state.missions.length;
    const done = this.completedCount();
    const daysAway = this.daysBetween(this.state.day, this.today);
    const missedDays = this.state.claimed ? Math.max(0, daysAway - 1) : daysAway;
    const previousRecord = this.state.history[this.state.day] || {};

    if (missedDays > 0) {
      const before = this.state.rewardMultiplier;
      this.state.rewardMultiplier = Math.max(0.5, this.round2(this.state.rewardMultiplier - (0.1 * missedDays)));
      this.state.streak = 0;
      if (!this.state.claimed) {
        this.state.history[this.state.day] = { ...previousRecord, outcome: 'missed', rewardMultiplierAfter: this.state.rewardMultiplier };
      }
      this.logActivity('system', missedDays === 1 ? 'Daily plan missed' : missedDays + ' daily plans missed', done + '/' + total + ' missions completed on the last active day. Reward multiplier reduced from ' + before.toFixed(2) + 'x to ' + this.state.rewardMultiplier.toFixed(2) + 'x.');
    }

    this.state.day = this.today;
    this.state.missions = this.createDailyMissions(this.state.difficulty, this.today);
    this.state.completed = {};
    this.state.claimed = false;
    this.state.water = 0;
    this.state.focusSeconds = 0;
    this.logActivity('system', 'New daily plan generated', this.difficultyName(this.state.difficulty) + ' missions are ready for today.');
    this.updateDayRecord();
    this.save();
  }

  completedCount() { return Object.values(this.state.completed).filter(Boolean).length; }
  taskCount() { return this.state.missions.length; }
  missionXp(mission) { return Math.round(mission.baseXp * this.state.rewardMultiplier); }

  toggleMission(input) {
    const item = input.closest('.task-item');
    const mission = this.state.missions.find(entry => entry.id === item.dataset.taskId);
    if (!mission || this.state.claimed) return;
    this.state.completed[mission.id] = input.checked;
    const xp = this.missionXp(mission);
    if (input.checked) {
      this.addExp(xp);
      this.unlock('firstMission');
      this.logActivity('mission', 'Mission completed', mission.title + ' completed for +' + xp + ' XP.');
      this.showToast('Mission logged: +' + xp + ' XP');
      this.playTone(660);
    } else {
      this.removeExp(xp);
      this.logActivity('mission', 'Mission reopened', mission.title + ' marked incomplete. ' + xp + ' XP removed.');
      this.showToast('Mission marked incomplete.');
    }
    this.updateDayRecord();
    this.save();
    this.render();
  }

  claimReward() {
    if (this.state.claimed || this.completedCount() < this.taskCount()) return;
    const reward = this.clearReward();
    const loot = this.getLoot();
    const previousCompletedDate = this.state.lastCompletedDate;
    this.state.claimed = true;
    this.addExp(reward.xp);
    this.state.coins += reward.coins;
    this.state.inventory.unshift({ ...loot, date: this.today });
    this.state.lastCompletedDate = this.today;
    this.state.streak = previousCompletedDate === this.dateKey(-1) ? this.state.streak + 1 : 1;
    this.state.rewardMultiplier = Math.min(1.5, this.round2(this.state.rewardMultiplier + 0.05));
    this.unlock('dailyClear');
    if (this.state.streak >= 3) this.unlock('threeDayStreak');
    if (this.state.inventory.length >= 3) this.unlock('collector');
    this.logActivity('reward', 'Reward cache opened', '+' + reward.xp + ' XP, +' + reward.coins + ' FIT coins and ' + loot.name + ' collected.');
    this.updateDayRecord({ outcome: 'completed', reward: { ...reward, loot: loot.name } });
    this.save();
    this.render();
    this.showToast('Cache opened: ' + loot.name + ' + ' + reward.coins + ' coins');
    this.playTone(880);
    setTimeout(() => this.playTone(1175), 120);
  }

  clearReward() {
    const rewards = { beginner: { xp: 30, coins: 10 }, medium: { xp: 55, coins: 20 }, advanced: { xp: 80, coins: 35 } };
    const base = rewards[this.state.difficulty];
    return { xp: Math.round(base.xp * this.state.rewardMultiplier), coins: Math.round(base.coins * this.state.rewardMultiplier) };
  }

  getLoot() {
    const rewards = [
      { name: 'Momentum badge', icon: 'M' }, { name: 'Recovery token', icon: 'R' }, { name: 'Focus crystal', icon: 'F' },
      { name: 'Power shard', icon: 'P' }, { name: 'Streak emblem', icon: 'S' }
    ];
    return rewards[(this.daysFromStart(this.today) + this.state.level + this.state.inventory.length) % rewards.length];
  }

  logWater(change) {
    const previous = this.state.water;
    this.state.water = Math.max(0, Math.min(8, this.state.water + change));
    if (previous === this.state.water) return;
    this.logActivity('recovery', change > 0 ? 'Hydration logged' : 'Hydration adjusted', this.state.water + '/8 glasses recorded for today.');
    if (this.state.water === 8) {
      this.showToast('Recovery ready. Hydration goal completed!');
      this.playTone(740);
    }
    this.updateDayRecord();
    this.save();
    this.render();
  }

  addExp(amount) {
    this.state.exp += amount;
    let leveled = false;
    while (this.state.exp >= this.state.expToNextLevel) {
      this.state.exp -= this.state.expToNextLevel;
      this.state.level += 1;
      this.state.expToNextLevel = Math.floor(this.state.expToNextLevel * 1.35);
      leveled = true;
    }
    if (leveled) {
      this.logActivity('reward', 'Level up', 'Reached level ' + this.state.level + '.');
      this.showToast('Level up! You are now level ' + this.state.level + '.');
      this.playTone(990);
    }
  }

  removeExp(amount) { this.state.exp = Math.max(0, this.state.exp - amount); }
  unlock(id) { this.state.achievements[id] = true; }

  toggleTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      if (this.sessionSeconds) {
        this.state.focusSeconds += this.sessionSeconds;
        this.logActivity('focus', 'Focus session logged', this.formatDuration(this.sessionSeconds) + ' added to today\'s focused time.');
        this.sessionSeconds = 0;
        this.updateDayRecord();
        this.save();
      }
      this.updateTimer();
      this.el.timerToggle.textContent = 'Resume focus';
      this.el.timerPanel.classList.remove('running');
      this.render();
      return;
    }
    this.timerInterval = setInterval(() => { this.sessionSeconds += 1; this.updateTimer(); }, 1000);
    this.el.timerToggle.textContent = 'Pause focus';
    this.el.timerPanel.classList.add('running');
    this.logActivity('focus', 'Focus session started', 'Training focus timer started.');
    this.save();
    this.playTone(520);
  }

  resetTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    if (this.sessionSeconds) this.logActivity('focus', 'Focus timer reset', this.formatDuration(this.sessionSeconds) + ' unlogged timer time cleared.');
    this.sessionSeconds = 0;
    this.updateTimer();
    this.el.timerToggle.textContent = 'Start focus';
    this.el.timerPanel.classList.remove('running');
    this.save();
    this.renderLogs();
  }

  updateTimer() { this.el.timer.textContent = this.formatDuration(this.sessionSeconds); }

  updateDayRecord(extra = {}) {
    if (!this.state.profile) return;
    const total = this.taskCount();
    const done = this.completedCount();
    this.state.history[this.state.day] = {
      ...(this.state.history[this.state.day] || {}),
      date: this.state.day,
      difficulty: this.state.difficulty,
      missionTitles: this.state.missions.map(mission => mission.title),
      completedMissionIds: Object.keys(this.state.completed).filter(id => this.state.completed[id]),
      completionPercent: total ? Math.round((done / total) * 100) : 0,
      claimed: this.state.claimed,
      water: this.state.water,
      focusSeconds: this.state.focusSeconds,
      rewardMultiplier: this.state.rewardMultiplier,
      ...extra
    };
  }

  logActivity(type, title, detail) {
    this.state.activityLog.unshift({
      id: Date.now() + '-' + Math.random().toString(16).slice(2),
      timestamp: new Date().toISOString(),
      date: this.today,
      type, title, detail
    });
  }

  render() {
    const done = this.completedCount();
    const total = this.taskCount();
    const percent = total ? Math.round((done / total) * 100) : 0;
    this.renderProfile();
    this.renderMissions();
    this.el.level.textContent = this.state.level;
    this.el.exp.textContent = this.state.exp;
    this.el.nextExp.textContent = this.state.expToNextLevel;
    this.el.streak.textContent = this.state.streak;
    this.el.coins.textContent = this.state.coins;
    this.el.multiplier.textContent = this.state.rewardMultiplier.toFixed(2);
    this.el.expProgress.style.width = (this.state.exp / this.state.expToNextLevel) * 100 + '%';
    this.el.completed.textContent = done;
    this.el.total.textContent = total;
    this.el.questCount.textContent = done + ' / ' + total;
    this.el.consistency.textContent = percent + '%';
    this.el.consistencyProgress.style.width = percent + '%';
    this.el.claim.disabled = done < total || this.state.claimed;
    this.el.claim.innerHTML = this.state.claimed ? 'Reward collected <span>&#10003;</span>' : 'Open reward cache <span>&rarr;</span>';
    this.el.hint.textContent = this.state.claimed ? 'Daily cache collected. Keep the routine going tomorrow.' : done === total ? 'All missions complete. Your reward cache is ready.' : (total - done) + ' mission' + (total - done === 1 ? '' : 's') + ' remaining. Missed plans reduce tomorrow\'s multiplier.';
    this.el.water.textContent = this.state.water;
    this.el.waterFill.style.width = this.state.water * 12.5 + '%';
    this.el.focusTotal.textContent = this.formatDuration(this.state.focusSeconds);
    this.renderRewards();
    this.renderAchievements();
    this.renderChart();
    this.renderLifetimeStats();
    this.renderLogs();
  }

  renderProfile() {
    const profile = this.state.profile;
    const difficulty = this.difficultyName(this.state.difficulty);
    this.el.playerName.textContent = profile.name;
    this.el.profileName.textContent = profile.name;
    this.el.profileInitial.textContent = profile.name.slice(0, 1).toUpperCase();
    this.el.profileMeta.textContent = difficulty + ' plan · ' + profile.gender + ' · ' + profile.age;
    this.el.planLabel.textContent = difficulty.toUpperCase() + ' DAILY PLAN';
    this.el.missionIntro.textContent = this.planDescription();
    this.el.missionDate.textContent = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase();
    this.el.dailyDirective.textContent = {
      beginner: 'Show up first. Confidence is built one completed mission at a time.',
      medium: 'Consistency turns occasional workouts into a training habit.',
      advanced: 'Discipline is doing today\'s work with the same intent as day one.'
    }[this.state.difficulty];
  }

  renderMissions() {
    this.el.taskList.innerHTML = '';
    this.state.missions.forEach(mission => {
      const item = document.createElement('div');
      const complete = Boolean(this.state.completed[mission.id]);
      item.className = 'task-item' + (complete ? ' completed' : '');
      item.dataset.taskId = mission.id;
      item.innerHTML = '<label class="task-main"><input type="checkbox" aria-label="' + this.escape(mission.title) + '"' + (complete ? ' checked' : '') + (this.state.claimed ? ' disabled' : '') + '><span class="custom-check"></span><span class="task-icon">' + this.escape(mission.icon) + '</span><span class="task-copy"><strong>' + this.escape(mission.title) + '</strong><small>' + this.escape(mission.subtitle) + '</small></span></label><button class="instruction-button" type="button" data-task-id="' + this.escape(mission.id) + '" aria-label="How to do ' + this.escape(mission.title) + '" title="How to do this exercise">?</button><span class="xp-reward">+' + this.missionXp(mission) + ' XP</span>';
      this.el.taskList.append(item);
    });
  }

  openExerciseGuide(mission) {
    const guide = this.getExerciseGuide(mission);
    this.el.guideCategory.textContent = guide.category;
    this.el.guideTitle.textContent = 'How to do: ' + mission.title;
    this.el.guideIntro.textContent = guide.intro;
    this.el.guideTip.textContent = guide.tip;
    this.el.guideSafety.textContent = guide.safety;
    this.el.guideSteps.replaceChildren();
    guide.steps.forEach(step => {
      const item = document.createElement('li');
      item.textContent = step;
      this.el.guideSteps.append(item);
    });
    this.el.guideModal.hidden = false;
    document.body.classList.add('guide-open');
    this.el.guideClose.focus();
    this.logActivity('system', 'Exercise guide viewed', 'Viewed instructions for ' + mission.title + '.');
    this.save();
    this.renderLogs();
  }

  closeExerciseGuide() {
    this.el.guideModal.hidden = true;
    document.body.classList.remove('guide-open');
  }

  getExerciseGuide(mission) {
    const name = mission.title.toLowerCase();
    const guides = {
      wallPushup: { category: 'WALL PUSH-UP GUIDE', intro: 'A low-impact push-up variation that lets you build pressing strength with control.', steps: ['Stand facing a wall, about one arm length away.', 'Place both palms on the wall at chest height, slightly wider than your shoulders.', 'Keep your body in one straight line as you bend your elbows and bring your chest toward the wall.', 'Press through your palms until your arms are straight again.'], tip: 'Keep your elbows angled slightly back, not flared straight out to the sides.', safety: 'Move slowly and stop if you feel sharp pain in your wrists, shoulders or chest.' },
      pushup: { category: 'PUSH-UP GUIDE', intro: 'A bodyweight upper-body exercise for your chest, shoulders, arms and core.', steps: ['Start in a high plank with hands just wider than your shoulders.', 'Brace your core and keep your head, back and hips in one line.', 'Bend your elbows to lower your chest toward the floor.', 'Push the floor away until your arms are straight, then repeat with control.'], tip: 'Keep your hips level; do not let your lower back sag or your hips rise first.', safety: 'Use knees or an elevated surface if needed. Stop if you feel sharp shoulder or wrist pain.' },
      chairSquat: { category: 'CHAIR SQUAT GUIDE', intro: 'A supported squat that helps you practise safe lower-body movement.', steps: ['Stand in front of a sturdy chair with feet about hip-width apart.', 'Reach your hips back and bend your knees as if you are going to sit down.', 'Lightly touch the chair with control, keeping your chest tall.', 'Press through your feet to stand back up.'], tip: 'Keep your knees tracking in the same direction as your toes.', safety: 'Use a stable chair that will not slide. Hold a counter lightly for balance if needed.' },
      squat: { category: 'BODYWEIGHT SQUAT GUIDE', intro: 'A foundational lower-body movement for legs, hips and everyday strength.', steps: ['Stand with feet around shoulder-width apart and toes slightly turned out.', 'Brace your core and send your hips back as you bend your knees.', 'Lower as far as feels comfortable while keeping your chest proud.', 'Press through your whole foot to stand tall again.'], tip: 'Keep weight balanced through your heels and mid-foot instead of shifting onto your toes.', safety: 'Use a shorter range of motion if your knees or hips feel uncomfortable.' },
      plank: { category: 'PLANK GUIDE', intro: 'A static core exercise that teaches full-body tension and trunk control.', steps: ['Place your forearms on the floor with elbows below your shoulders.', 'Step or walk your feet back until your body forms a long line.', 'Gently squeeze your glutes and brace your stomach.', 'Breathe steadily while holding the position for the prescribed time.'], tip: 'Think about pulling your ribs toward your hips to avoid arching your lower back.', safety: 'Stop if you feel lower-back pain. An elevated plank on a bench or table is a valid option.' },
      walk: { category: 'WALKING GUIDE', intro: 'A simple cardio session designed to improve daily movement and endurance.', steps: ['Choose a safe, flat route and wear supportive footwear.', 'Start at an easy pace for the first minute.', 'Walk tall with relaxed shoulders and let your arms swing naturally.', 'Keep a pace that raises your breathing slightly but still allows short sentences.'], tip: 'Look forward instead of down at your phone to keep your posture upright.', safety: 'Slow down or stop if you feel dizzy, unwell, or unusually short of breath.' },
      march: { category: 'STANDING MARCH GUIDE', intro: 'A gentle low-impact cardio movement you can do in a small space.', steps: ['Stand tall near a wall or chair if you want balance support.', 'Lift one knee comfortably, then lower it with control.', 'Alternate legs in a steady rhythm while swinging the opposite arm.', 'Keep going for the prescribed time at a pace you can control.'], tip: 'Lift only as high as you can without leaning backward.', safety: 'Keep a stable support close by if balance is a concern.' },
      mobility: { category: 'MOBILITY GUIDE', intro: 'A gentle movement session to keep joints moving comfortably through their available range.', steps: ['Begin with slow neck, shoulder and arm circles.', 'Add controlled hip circles, knee bends and ankle circles.', 'Move smoothly within a comfortable range; do not force a stretch.', 'Finish with a few slow breaths and relaxed full-body reaches.'], tip: 'Use controlled motions rather than bouncing or forcing the joint farther.', safety: 'Avoid any movement that causes pain, numbness or dizziness.' },
      bridge: { category: 'GLUTE BRIDGE GUIDE', intro: 'A floor exercise that strengthens the glutes and supports hip control.', steps: ['Lie on your back with knees bent and feet flat, about hip-width apart.', 'Place your arms by your sides and gently brace your stomach.', 'Press through your heels and squeeze your glutes to lift your hips.', 'Pause briefly, then lower your hips slowly back to the floor.'], tip: 'Lift from your hips without over-arching your lower back.', safety: 'Keep the motion comfortable and stop if your back feels strained.' },
      stretch: { category: 'STRETCHING GUIDE', intro: 'A relaxed flexibility session to help your body cool down and recover.', steps: ['Warm up with a minute of easy walking or marching first.', 'Choose gentle stretches for the calves, thighs, hips, chest and shoulders.', 'Hold each position while breathing slowly; do not bounce.', 'Release slowly before moving to the next area.'], tip: 'Aim for a mild pulling feeling, never pain or numbness.', safety: 'Do not force a joint into a position it cannot comfortably reach.' },
      calfRaise: { category: 'CALF RAISE GUIDE', intro: 'A simple standing movement for the calves, ankles and balance.', steps: ['Stand tall with feet hip-width apart near a wall or chair.', 'Press through the balls of both feet to lift your heels.', 'Pause briefly at the top while staying tall.', 'Lower your heels slowly and with control.'], tip: 'Use a light touch on a wall or chair for balance, not to pull yourself up.', safety: 'Keep the range comfortable if you have ankle or foot discomfort.' },
      lunge: { category: 'REVERSE LUNGE GUIDE', intro: 'A controlled single-leg movement that challenges balance and lower-body strength.', steps: ['Stand tall with feet under your hips.', 'Step one foot back and lower both knees with control.', 'Keep your front foot planted and torso upright.', 'Press through the front foot to return to standing, then switch sides.'], tip: 'Take a step long enough that your front heel stays down as you lower.', safety: 'Hold a stable support or reduce depth if balance or knee comfort is limited.' },
      climber: { category: 'MOUNTAIN CLIMBER GUIDE', intro: 'A dynamic core and cardio exercise done from a strong plank position.', steps: ['Start in a high plank with hands below your shoulders.', 'Keep your body steady as you bring one knee toward your chest.', 'Return that foot to the floor and switch legs.', 'Alternate at a smooth, controlled pace for the prescribed amount.'], tip: 'Keep your shoulders above your hands and avoid bouncing your hips upward.', safety: 'Slow down or use an elevated surface if wrists or shoulders need less load.' },
      jack: { category: 'JUMPING JACK GUIDE', intro: 'A full-body cardio movement that can be performed with or without jumping.', steps: ['Stand tall with arms by your sides and feet together or hip-width apart.', 'Step or jump your feet out while raising your arms overhead.', 'Return your feet and arms to the starting position.', 'Repeat at a steady pace that keeps you in control.'], tip: 'Use the step-out version instead of jumping to reduce impact.', safety: 'Land softly with bent knees and stop if you feel joint pain or dizziness.' },
      burpee: { category: 'BURPEE GUIDE', intro: 'A full-body conditioning exercise. Keep the pace controlled rather than rushing.', steps: ['Stand tall, then lower into a squat and place your hands on the floor.', 'Step or jump your feet back into a high plank.', 'Step or jump your feet forward toward your hands.', 'Stand up, adding a small jump only if it feels comfortable.'], tip: 'Stepping your feet back and forward is a strong low-impact version.', safety: 'Keep your back neutral while reaching for the floor. Stop if you feel dizzy or have sharp pain.' }
    };
    if (name.includes('wall push')) return guides.wallPushup;
    if (name.includes('push-up')) return guides.pushup;
    if (name.includes('chair squat')) return guides.chairSquat;
    if (name.includes('squat')) return guides.squat;
    if (name.includes('plank')) return guides.plank;
    if (name.includes('walk') || name.includes('cardio session')) return guides.walk;
    if (name.includes('march')) return guides.march;
    if (name.includes('mobility')) return guides.mobility;
    if (name.includes('glute bridge')) return guides.bridge;
    if (name.includes('stretch')) return guides.stretch;
    if (name.includes('calf raise')) return guides.calfRaise;
    if (name.includes('lunge')) return guides.lunge;
    if (name.includes('mountain climber')) return guides.climber;
    if (name.includes('jumping jack')) return guides.jack;
    if (name.includes('burpee')) return guides.burpee;
    return { category: 'MOVEMENT GUIDE', intro: 'Perform this exercise with slow, comfortable control and use a variation that suits your current ability.', steps: ['Set up in a stable position and take a calm breath.', 'Move through a comfortable range with controlled speed.', 'Keep your core gently braced and your joints aligned.', 'Rest whenever your form starts to break down.'], tip: 'Quality of movement is more important than speed or range.', safety: 'Stop if you feel sharp pain, dizziness, numbness or anything that feels wrong.' };
  }

  renderRewards() {
    const last = this.state.inventory[0];
    this.el.latestReward.textContent = last ? last.name : 'No rewards collected yet';
    this.el.inventoryCount.textContent = this.state.inventory.length;
    this.el.inventoryList.innerHTML = this.state.inventory.slice(0, 6).map(item => '<span class="inventory-chip" title="' + this.escape(item.name) + '">' + this.escape(item.icon) + '</span>').join('');
  }

  renderAchievements() {
    const unlocked = Object.keys(this.state.achievements).filter(id => this.state.achievements[id]).length;
    this.el.achievementCount.textContent = unlocked;
    document.querySelectorAll('.achievement-card').forEach(card => {
      const active = Boolean(this.state.achievements[card.dataset.achievement]);
      card.classList.toggle('unlocked', active);
      card.querySelector('.achievement-status').textContent = active ? 'UNLOCKED' : 'LOCKED';
    });
  }

  renderChart() {
    const formatter = new Intl.DateTimeFormat('en', { weekday: 'short' });
    const days = [...Array(7)].map((_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    this.el.chart.innerHTML = days.map((date, index) => {
      const key = date.toLocaleDateString('en-CA');
      const value = key === this.today ? Math.round((this.completedCount() / this.taskCount()) * 100) : (this.state.history[key]?.completionPercent || 0);
      return '<div class="chart-day ' + (index === 6 ? 'today' : '') + '"><div class="chart-bar-wrap"><div class="chart-bar" style="height:' + Math.max(value, 3) + '%"></div></div><span>' + formatter.format(date).toUpperCase() + '</span></div>';
    }).join('');
  }

  renderLifetimeStats() {
    const history = Object.values(this.state.history);
    const completedDays = history.filter(day => day.claimed).length;
    const focus = history.reduce((sum, day) => sum + (day.focusSeconds || 0), 0);
    this.el.daysCompleted.textContent = completedDays;
    this.el.lifetimeFocus.textContent = this.formatDuration(focus);
    this.el.recordCount.textContent = this.state.activityLog.length;
  }

  renderLogs() {
    const filter = this.el.logFilter.value;
    const logs = this.state.activityLog.filter(entry => filter === 'all' || entry.type === filter);
    if (!logs.length) {
      this.el.activityLog.innerHTML = '<p class="empty-log">No matching activity records yet.</p>';
      return;
    }
    this.el.activityLog.innerHTML = logs.map(entry => {
      const date = new Date(entry.timestamp);
      const time = date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + '<br>' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return '<article class="log-entry ' + this.escape(entry.type) + '"><time class="log-time">' + time + '</time><span class="log-dot"></span><div class="log-content"><strong>' + this.escape(entry.title) + '</strong><span>' + this.escape(entry.detail) + '</span></div></article>';
    }).join('');
  }

  exportRecords() {
    this.logActivity('system', 'Records exported', 'A JSON backup of your FIT EXP records was created.');
    this.updateDayRecord();
    this.save();
    const exportData = {
      exportedAt: new Date().toISOString(),
      app: 'FIT EXP',
      profile: this.state.profile,
      trainingStats: { level: this.state.level, exp: this.state.exp, coins: this.state.coins, streak: this.state.streak, rewardMultiplier: this.state.rewardMultiplier },
      dailyHistory: this.state.history,
      activityLog: this.state.activityLog,
      inventory: this.state.inventory
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fit-exp-records-' + this.today + '.json';
    link.click();
    URL.revokeObjectURL(url);
    this.renderLogs();
    this.showToast('FIT EXP records exported.');
  }

  startClock() {
    const update = () => {
      const now = new Date();
      document.getElementById('clock-time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      document.getElementById('today-date').textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
      document.getElementById('day-period').textContent = now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening';
    };
    update();
    setInterval(update, 30000);
  }

  difficultyName(difficulty) { return ({ beginner: 'Beginner', medium: 'Medium', advanced: 'Advanced' })[difficulty] || 'Personal'; }
  planDescription() { return { beginner: 'A short, low-pressure plan to help you make daily movement feel normal.', medium: 'A balanced plan to turn irregular exercise into dependable consistency.', advanced: 'A higher-volume plan for athletes already comfortable with regular training.' }[this.state.difficulty]; }
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining = seconds % 60;
    return hours ? String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(remaining).padStart(2, '0') : String(minutes).padStart(2, '0') + ':' + String(remaining).padStart(2, '0');
  }
  round2(value) { return Math.round(value * 100) / 100; }
  escape(value) { const element = document.createElement('div'); element.textContent = value; return element.innerHTML; }
  showToast(message) { this.el.toastText.textContent = message; this.el.toast.classList.add('show'); clearTimeout(this.toastTimeout); this.toastTimeout = setTimeout(() => this.el.toast.classList.remove('show'), 3200); }
  playTone(frequency) {
    if (this.state.settings.soundsMuted) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .17);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + .17);
    } catch { /* Sound is optional. */ }
  }
}

document.addEventListener('DOMContentLoaded', () => new FitExpSystem());
