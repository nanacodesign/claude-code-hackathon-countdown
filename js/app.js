(() => {
  const EVENT_YEAR = 2026;
  const EASTERN_OFFSET = '-04:00';
  const EVENT_START = new Date('2026-04-21T12:30:00-04:00');
  const EVENT_END = new Date('2026-04-26T20:00:00-04:00');
  const TOTAL_BARS = 15;
  const REPO_NAME = 'nanacodesign/claude-code-hackathon-countdown';
  const MONTHS = {
    January: 1,
    February: 2,
    March: 3,
    April: 4,
    May: 5,
    June: 6,
    July: 7,
    August: 8,
    September: 9,
    October: 10,
    November: 11,
    December: 12
  };

  const subtitle = document.getElementById('subtitle');
  const statusBadge = document.getElementById('statusBadge');
  const hoursPiece = document.getElementById('hours');
  const minutesPiece = document.getElementById('minutes');
  const secondsPiece = document.getElementById('seconds');
  const daysLeftEl = document.getElementById('daysLeft');
  const barSegments = document.getElementById('barSegments');
  const starCount = document.getElementById('starCount');
  const timelineList = document.getElementById('timelineList');

  let currentState = null;
  let intervalId = null;

  function pad(val) {
    return (val < 10 && val > -1 ? '0' : '') + val;
  }

  function pad2(val) {
    return String(val).padStart(2, '0');
  }

  function escapeHtml(str) {
    return str
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function renderInlineMarkdown(text) {
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    let rendered = '';
    let lastIndex = 0;
    let match;

    while ((match = linkPattern.exec(text)) !== null) {
      rendered += escapeHtml(text.slice(lastIndex, match.index));
      rendered += `<a href="${escapeHtml(match[2])}" target="_blank" rel="noopener">${escapeHtml(match[1])}</a>`;
      lastIndex = match.index + match[0].length;
    }

    rendered += escapeHtml(text.slice(lastIndex));
    return rendered;
  }

  function flipTo(piece, newValue) {
    const paddedValue = pad(newValue);
    const top = piece.querySelector('.clock__card-top');
    const bottom = piece.querySelector('.clock__card-bottom');
    const back = piece.querySelector('.clock__card-back');
    const backBottom = piece.querySelector('.clock__card-back-bottom');

    if (top.textContent === paddedValue) return;
    back.setAttribute('data-value', top.textContent);
    backBottom.setAttribute('data-value', top.textContent);
    top.textContent = paddedValue;
    bottom.setAttribute('data-value', paddedValue);
    piece.classList.remove('flip');
    void piece.offsetWidth;
    piece.classList.add('flip');
  }

  function determineState() {
    const now = new Date();

    if (now < EVENT_START) return 'off';
    if (now > EVENT_END) return 'expired';
    return 'on';
  }

  function getTargetTime() {
    const state = determineState();

    if (state === 'off') return EVENT_START;
    if (state === 'on') return EVENT_END;
    return new Date();
  }

  function buildProgressBar() {
    barSegments.innerHTML = '';

    for (let i = 0; i < TOTAL_BARS; i++) {
      const seg = document.createElement('div');
      seg.className = 'bar__segment';
      barSegments.appendChild(seg);
    }
  }

  function formatDayCount(ms) {
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  function updateProgressBar() {
    const now = new Date();
    const totalMs = EVENT_END - EVENT_START;
    const remainingMs = Math.min(Math.max(EVENT_END - now, 0), totalMs);
    const remainingBars = totalMs > 0
      ? Math.min(TOTAL_BARS, Math.ceil((remainingMs / totalMs) * TOTAL_BARS))
      : 0;

    if (now < EVENT_START) {
      const daysUntilStart = formatDayCount(EVENT_START - now);
      daysLeftEl.textContent = `${daysUntilStart} day${daysUntilStart !== 1 ? 's' : ''} until kickoff`;
    } else if (now <= EVENT_END) {
      const daysLeft = formatDayCount(EVENT_END - now);
      daysLeftEl.textContent = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
    } else {
      daysLeftEl.textContent = 'hackathon complete';
    }

    const segments = barSegments.querySelectorAll('.bar__segment');
    segments.forEach((seg, i) => {
      seg.className = i < remainingBars
        ? 'bar__segment bar__segment--active'
        : 'bar__segment bar__segment--inactive';
    });
  }

  function applyState(newState) {
    const bodyState = newState === 'on' ? 'state-on' : 'state-off';

    if (currentState === `${newState}:${bodyState}`) return;
    currentState = `${newState}:${bodyState}`;
    document.body.className = bodyState;

    if (newState === 'on') {
      statusBadge.textContent = 'LIVE';
      subtitle.textContent = 'hackathon ends in';
    } else if (newState === 'off') {
      statusBadge.textContent = 'SOON';
      subtitle.textContent = 'hackathon starts in';
    } else {
      statusBadge.textContent = 'DONE';
      subtitle.textContent = 'The hackathon has wrapped';
    }
  }

  function updateCountdown() {
    const state = determineState();
    applyState(state);

    if (state === 'expired') {
      flipTo(hoursPiece, 0);
      flipTo(minutesPiece, 0);
      flipTo(secondsPiece, 0);
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      return;
    }

    const now = new Date();
    const target = getTargetTime();
    let diff = Math.max(0, Math.floor((target - now) / 1000));

    const hours = Math.floor(diff / 3600);
    diff %= 3600;
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;

    flipTo(hoursPiece, hours);
    flipTo(minutesPiece, minutes);
    flipTo(secondsPiece, seconds);
  }

  function parseDayTitle(dayTitle) {
    const match = dayTitle.match(/^[A-Za-z]+,\s+([A-Za-z]+)\s+(\d+)(?:st|nd|rd|th)$/);
    if (!match) return null;

    return {
      month: MONTHS[match[1]],
      day: Number(match[2])
    };
  }

  function parseClock(timeText, meridiem) {
    const [rawHours, rawMinutes] = timeText.split(':').map(Number);
    let hours = rawHours;

    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    return { hours, minutes: rawMinutes };
  }

  function makeEasternDate(dayInfo, timeText, meridiem) {
    const { hours, minutes } = parseClock(timeText, meridiem);
    return new Date(
      `${EVENT_YEAR}-${pad2(dayInfo.month)}-${pad2(dayInfo.day)}T${pad2(hours)}:${pad2(minutes)}:00${EASTERN_OFFSET}`
    );
  }

  function formatLocalDateTime(date) {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }

  function formatLocalDate(date) {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  function formatDayShort(dayTitle) {
    const match = dayTitle.match(/^([A-Za-z]+),\s+([A-Za-z]+)\s+(\d+)(?:st|nd|rd|th)$/);
    if (!match) return dayTitle;

    return `${match[3]} ${match[2].slice(0, 3)} ${match[1].slice(0, 3)}`;
  }

  function formatCompactLocalClock(date) {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const suffix = hours >= 12 ? 'pm' : 'am';

    hours %= 12;
    if (hours === 0) hours = 12;

    return `${hours}:${minutes}${suffix}`;
  }

  function formatCompactLocalDay(date) {
    return `${date.getDate()} ${date.toLocaleString(undefined, { month: 'short' })}`;
  }

  function formatSourceTimeLabel(timeLabel) {
    if (timeLabel === 'All Day') return 'all day';

    const rangeMatch = timeLabel.match(
      /^(\d{1,2}:\d{2})(?:\s+(AM|PM))?[–-](\d{1,2}:\d{2})\s+(AM|PM)\s+\((?:EST|EDT)\)$/i
    );
    if (rangeMatch) {
      const startSuffix = (rangeMatch[2] || '').toLowerCase();
      const endSuffix = rangeMatch[4].toLowerCase();
      const startTime = `${rangeMatch[1]}${startSuffix}`;
      const endTime = `${rangeMatch[3]}${endSuffix}`;
      return `${startTime}–${endTime}`;
    }

    const singleMatch = timeLabel.match(/^(\d{1,2}:\d{2})\s+(AM|PM)\s+\((?:EST|EDT)\)$/i);
    if (singleMatch) {
      return `${singleMatch[1]}${singleMatch[2].toLowerCase()}`;
    }

    return timeLabel;
  }

  function extractPrimaryTitle(description) {
    const primary = description.split(/\s[–-]\s|;\s*/)[0].trim();
    const words = primary.split(/\s+/).filter(Boolean).slice(0, 5);
    return words.join(' ');
  }

  function buildLocalTimeInfo(dayTitle, timeLabel) {
    const dayInfo = parseDayTitle(dayTitle);
    if (!dayInfo) return null;

    if (timeLabel === 'All Day') {
      const start = new Date(
        `${EVENT_YEAR}-${pad2(dayInfo.month)}-${pad2(dayInfo.day)}T00:00:00${EASTERN_OFFSET}`
      );
      const end = new Date(
        `${EVENT_YEAR}-${pad2(dayInfo.month)}-${pad2(dayInfo.day)}T23:59:59${EASTERN_OFFSET}`
      );

      return {
        start,
        end,
        localLabel: formatCompactLocalDay(start) === formatCompactLocalDay(end)
          ? `${formatCompactLocalDay(start)} ${formatCompactLocalClock(start)}–${formatCompactLocalClock(end)} local`
          : `${formatCompactLocalDay(start)} ${formatCompactLocalClock(start)}–${formatCompactLocalDay(end)} ${formatCompactLocalClock(end)} local`
      };
    }

    const rangeMatch = timeLabel.match(
      /^(\d{1,2}:\d{2})(?:\s+(AM|PM))?[–-](\d{1,2}:\d{2})\s+(AM|PM)\s+\((?:EST|EDT)\)$/i
    );
    if (rangeMatch) {
      const startMeridiem = (rangeMatch[2] || rangeMatch[4]).toUpperCase();
      const endMeridiem = rangeMatch[4].toUpperCase();
      const start = makeEasternDate(dayInfo, rangeMatch[1], startMeridiem);
      const end = makeEasternDate(dayInfo, rangeMatch[3], endMeridiem);

      return {
        start,
        end,
        localLabel: formatCompactLocalDay(start) === formatCompactLocalDay(end)
          ? `${formatCompactLocalDay(start)} ${formatCompactLocalClock(start)}–${formatCompactLocalClock(end)} local`
          : `${formatCompactLocalDay(start)} ${formatCompactLocalClock(start)}–${formatCompactLocalDay(end)} ${formatCompactLocalClock(end)} local`
      };
    }

    const singleMatch = timeLabel.match(/^(\d{1,2}:\d{2})\s+(AM|PM)\s+\((?:EST|EDT)\)$/i);
    if (singleMatch) {
      const start = makeEasternDate(dayInfo, singleMatch[1], singleMatch[2].toUpperCase());
      return {
        start,
        end: start,
        localLabel: `${formatCompactLocalDay(start)} ${formatCompactLocalClock(start)} local`
      };
    }

    return null;
  }

  function getChecklistState(timing) {
    if (!timing) return 'upcoming';

    const now = new Date();
    if (now >= timing.end) return 'done';
    if (now >= timing.start && now <= timing.end) return 'active';
    return 'upcoming';
  }

  function parseTimeline(markdown) {
    const schedule = [];
    let currentDay = null;
    let currentItem = null;

    markdown.split('\n').forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('## ')) return;

      const dayMatch = trimmed.match(/^- \*\*(.+?)\*\*$/);
      if (dayMatch) {
        currentDay = dayMatch[1];
        currentItem = null;
        return;
      }

      const eventMatch = trimmed.match(/^- \*\*(.+?):\*\*\s*(.+)$/);
      if (eventMatch && currentDay) {
        const timing = buildLocalTimeInfo(currentDay, eventMatch[1]);
        const title = extractPrimaryTitle(eventMatch[2]);
        currentItem = {
          label: title,
          localLabel: timing ? timing.localLabel : '',
          state: getChecklistState(timing)
        };
        schedule.push(currentItem);
        return;
      }

      const noteMatch = trimmed.match(/^- (.+)$/);
      if (noteMatch && currentItem) return;
    });

    return schedule;
  }

  function renderTimelineMarkup(schedule) {
    return `
      <ul class="timeline__checklist">
        ${schedule.map((item) => `
          <li class="timeline__item timeline__item--${item.state}">
            <span class="timeline__check" aria-hidden="true">${item.state === 'done' ? '✓' : ''}</span>
            <span class="timeline__text">
              <span class="timeline__main">${renderInlineMarkdown(item.label)}</span>
              ${item.localLabel ? `<span class="timeline__local"> · ${escapeHtml(item.localLabel)}</span>` : ''}
            </span>
          </li>
        `).join('')}
      </ul>
    `;
  }

  function syncTimelineViewport() {
    const target =
      timelineList.querySelector('.timeline__item--active') ||
      timelineList.querySelector('.timeline__item--upcoming') ||
      timelineList.querySelector('.timeline__item:last-child');

    if (!target) return;

    target.classList.add('timeline__item--focus');

    const listRect = timelineList.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextScrollTop =
      timelineList.scrollTop +
      (targetRect.top - listRect.top) -
      (timelineList.clientHeight / 2) +
      (targetRect.height / 2);

    timelineList.scrollTop = Math.max(0, nextScrollTop);
  }

  function renderTimeline() {
    fetch('claude.md')
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then((markdown) => {
        const schedule = parseTimeline(markdown);
        timelineList.innerHTML = schedule.length
          ? renderTimelineMarkup(schedule)
          : '<p class="timeline__loading">Checklist unavailable.</p>';
        syncTimelineViewport();
      })
      .catch(() => {
        timelineList.innerHTML = '<p class="timeline__loading">Checklist unavailable.</p>';
      });
  }

  function fetchStarCount() {
    fetch(`https://api.github.com/repos/${REPO_NAME}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (data.stargazers_count !== undefined) {
          starCount.textContent = data.stargazers_count;
        }
      })
      .catch(() => {});
  }

  function scheduleNextMidnight() {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    setTimeout(() => {
      updateProgressBar();
      renderTimeline();
      scheduleNextMidnight();
    }, tomorrow - now);
  }

  buildProgressBar();
  updateProgressBar();
  updateCountdown();
  renderTimeline();
  intervalId = setInterval(updateCountdown, 1000);
  setInterval(renderTimeline, 60000);
  scheduleNextMidnight();
  fetchStarCount();
})();
