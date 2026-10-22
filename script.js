const data = window.BRASA_DATA;

const escapeHTML = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character],
  );

const safeURL = (value) => {
  try {
    const url = new URL(value, location.href);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '#';
  } catch {
    return '#';
  }
};

const menu = document.getElementById('menu-toggle');
const nav = document.getElementById('nav');

function closeMenu() {
  nav.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Abrir menu');
}

menu.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(isOpen));
  menu.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nav.classList.contains('open')) {
    closeMenu();
    menu.focus();
  }
});

nav.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeMenu();
});

for (const kind of ['linkedin', 'email']) {
  if (!data.contacts[kind]) continue;

  document.querySelectorAll(`[data-contact="${kind}"]`).forEach((element) => {
    const link = document.createElement('a');
    link.textContent = kind === 'email' ? data.contacts.email : 'LinkedIn ↗';
    link.href =
      kind === 'email'
        ? `mailto:${data.contacts.email}`
        : safeURL(data.contacts.linkedin);

    if (kind === 'linkedin') {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }

    element.replaceWith(link);
  });
}

const officers = document.getElementById('officers');

if (officers && data.officers.length) {
  officers.className = 'officer-grid';
  officers.innerHTML = data.officers
    .map((officer) => {
      const nameParts = officer.name.trim().split(/\s+/);
      const initials = (
        nameParts[0][0] +
        (nameParts.length > 1 ? nameParts.at(-1)[0] : '')
      ).toUpperCase();

      const portrait = officer.photo
        ? `<img src="${escapeHTML(officer.photo)}" alt="Foto oficial de ${escapeHTML(officer.name)}" loading="lazy">`
        : `<div class="officer-placeholder" aria-hidden="true"><span>${escapeHTML(initials)}</span><small>BRASA UH</small></div>`;

      const linkedin = officer.linkedin
        ? `<a class="arrow-link" href="${escapeHTML(safeURL(officer.linkedin))}" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn de ${escapeHTML(officer.name)}">LinkedIn ↗</a>`
        : '';

      return `<article class="officer">${portrait}<h3>${escapeHTML(officer.name)}</h3><p>${escapeHTML(officer.role)}</p>${linkedin}</article>`;
    })
    .join('');
}

const partners = document.getElementById('local-partners');

if (partners && data.partners.length) {
  partners.className = 'partner-grid';
  partners.innerHTML = data.partners
    .map(
      (partner) =>
        `<article>${partner.logo ? `<img src="${escapeHTML(partner.logo)}" alt="${escapeHTML(partner.name)}" loading="lazy">` : ''}<h3>${escapeHTML(partner.name)}</h3><p>${escapeHTML(partner.benefit)}</p><p>${escapeHTML(partner.conditions)}</p><a class="arrow-link" href="${escapeHTML(safeURL(partner.url))}" target="_blank" rel="noopener noreferrer">Conhecer parceria ↗</a></article>`,
    )
    .join('');
}

const tabs = [...document.querySelectorAll('[role="tab"]')];

function activateTab(activeTab) {
  tabs.forEach((tab) => {
    const isActive = tab === activeTab;
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !isActive;
  });
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => {
    activateTab(tab);
    history.replaceState(null, '', tab.id === 'global-tab' ? '#global' : '#local');
  });

  tab.addEventListener('keydown', (event) => {
    let nextIndex;

    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;

    if (nextIndex !== undefined) {
      event.preventDefault();
      activateTab(tabs[nextIndex]);
      tabs[nextIndex].focus();
    }
  });
});

if (location.hash === '#global' && tabs.length) {
  activateTab(document.getElementById('global-tab'));
}

const calendar = document.getElementById('calendar');

if (calendar) {
  const nowParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const getDatePart = (key) =>
    Number(nowParts.find((part) => part.type === key).value);

  const today = {
    year: getDatePart('year'),
    month: getDatePart('month') - 1,
    day: getDatePart('day'),
  };

  let year = today.year;
  let month = today.month;

  const label = document.getElementById('month-label');
  const list = document.getElementById('event-list');
  const filter = document.getElementById('category');
  const dateKey = (currentYear, currentMonth, day) =>
    `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  function renderCalendar() {
    label.textContent = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month, 1));

    const monthPrefix = dateKey(year, month, 1).slice(0, 7);
    const events = data.events
      .filter(
        (event) =>
          event.date.startsWith(monthPrefix) &&
          (filter.value === 'all' || event.category === filter.value),
      )
      .sort((first, second) =>
        (first.date + (first.time || '')).localeCompare(
          second.date + (second.time || ''),
        ),
      );

    const firstDayOffset = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalDays = Math.ceil((firstDayOffset + daysInMonth) / 7) * 7;
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    let calendarHTML = `<div class="calendar-week">${weekdays
      .map((day) => `<div>${day}</div>`)
      .join('')}</div><div class="calendar-days">`;

    for (let index = 0; index < totalDays; index++) {
      const date = new Date(year, month, index - firstDayOffset + 1);
      const dateString = dateKey(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const isToday =
        dateString === dateKey(today.year, today.month, today.day);
      const isOutsideMonth = date.getMonth() !== month;
      const classes = [
        'day',
        ...(isOutsideMonth ? ['outside'] : []),
        ...(isToday ? ['today'] : []),
      ].join(' ');

      const dayEvents = events
        .filter((event) => event.date === dateString)
        .map(
          (event) =>
            `<a href="#event-${data.events.indexOf(event)}">${escapeHTML(event.title)}</a>`,
        )
        .join('');

      calendarHTML += `<div class="${classes}"${isToday ? ' aria-label="Hoje"' : ''}><span>${date.getDate()}</span>${dayEvents}</div>`;
    }

    calendar.innerHTML = `${calendarHTML}</div>`;

    list.innerHTML = events.length
      ? events
          .map(
            (event) =>
              `<article class="event-row" id="event-${data.events.indexOf(event)}"><time datetime="${escapeHTML(event.date)}">${event.date.slice(8, 10)}/${event.date.slice(5, 7)}${event.time ? `<br>${escapeHTML(event.time)}` : ''}</time><div><span class="eyebrow">${escapeHTML(event.category)}</span><h3>${escapeHTML(event.title)}</h3><p>${escapeHTML(event.location)}</p><p>${escapeHTML(event.description)}</p></div>${event.url ? `<a class="arrow-link" href="${escapeHTML(safeURL(event.url))}" target="_blank" rel="noopener noreferrer">Ver detalhes ↗</a>` : ''}</article>`,
          )
          .join('')
      : `<div class="agenda-empty"><p>Nenhum evento publicado para este mês${filter.value === 'all' ? '' : ', nesta categoria'}.</p><small>As próximas datas serão adicionadas assim que confirmadas.</small></div>`;
  }

  document.getElementById('previous-month').addEventListener('click', () => {
    month--;

    if (month < 0) {
      month = 11;
      year--;
    }

    renderCalendar();
  });

  document.getElementById('next-month').addEventListener('click', () => {
    month++;

    if (month > 11) {
      month = 0;
      year++;
    }

    renderCalendar();
  });

  document.getElementById('today').addEventListener('click', () => {
    year = today.year;
    month = today.month;
    renderCalendar();
  });

  filter.addEventListener('change', renderCalendar);
  renderCalendar();
}
