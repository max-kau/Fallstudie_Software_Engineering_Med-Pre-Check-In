/**
 * Utility for generating and exporting .ics calendar files for appointments.
 */

export function parseApptDateTime(dateStr, timeStr) {
  try {
    if (!dateStr) return new Date();

    let year, month, day;

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parts = dateStr.split('-').map(Number);
      year = parts[0];
      month = parts[1] - 1;
      day = parts[2];
    } else {
      const match = dateStr.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]{3,10}|\d{1,2})\.?\s*(\d{4})?/);
      if (match) {
        day = parseInt(match[1], 10);
        const mStr = match[2].toLowerCase();
        year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();

        const monthMap = {
          'jan': 0, 'januar': 0, 'feb': 1, 'februar': 1, 'mär': 2, 'märz': 2, 'mar': 2,
          'apr': 3, 'april': 3, 'mai': 4, 'jun': 5, 'juni': 5, 'jul': 6, 'juli': 6,
          'aug': 7, 'august': 7, 'sep': 8, 'september': 8, 'okt': 9, 'oktober': 9,
          'nov': 10, 'november': 10, 'dez': 11, 'dezember': 11
        };

        if (!isNaN(parseInt(mStr, 10))) {
          month = parseInt(mStr, 10) - 1;
        } else {
          const monthPrefix = mStr.substring(0, 3);
          month = monthMap[monthPrefix] !== undefined ? monthMap[monthPrefix] : new Date().getMonth();
        }
      } else {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return new Date();
        year = d.getFullYear();
        month = d.getMonth();
        day = d.getDate();
      }
    }

    let hour = 9, minute = 0;
    if (timeStr) {
      const tMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (tMatch) {
        hour = parseInt(tMatch[1], 10);
        minute = parseInt(tMatch[2], 10);
      }
    }

    const result = new Date(year, month, day, hour, minute, 0);
    return isNaN(result.getTime()) ? new Date() : result;
  } catch (err) {
    console.error('Error parsing appt date/time:', err);
    return new Date();
  }
}

export function generateIcsContent(appt) {
  const startDate = parseApptDateTime(appt.date, appt.time);
  const durationMs = (appt.duration_minutes || 30) * 60 * 1000;
  const endDate = new Date(startDate.getTime() + durationMs);

  const formatDateToICS = (dt) => {
    try {
      return dt.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    } catch (e) {
      return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }
  };

  const title = `Arzttermin: ${appt.praxis || 'Praxis'} (${appt.doctor || appt.fachrichtung || 'Arzt'})`;
  const location = appt.adresse || appt.praxis_adresse || '';
  const description = `Praxis: ${appt.praxis || ''}\\nHinweis: Bitte bringen Sie Ihre Versichertenkarte mit. Bei Fragen kontaktieren Sie bitte die Praxis direkt.`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Doctolib PreCheckIn//Terminkalender 1.0//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:termin-${appt.code || Date.now()}@doctolib-precheckin`,
    `DTSTAMP:${formatDateToICS(new Date())}`,
    `DTSTART:${formatDateToICS(startDate)}`,
    `DTEND:${formatDateToICS(endDate)}`,
    `SUMMARY:${title.replace(/[\r\n]/g, ' ')}`,
    `LOCATION:${location.replace(/[\r\n]/g, ' ')}`,
    `DESCRIPTION:${description}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

export function exportAppointmentToIcs(appt) {
  try {
    const icsContent = generateIcsContent(appt);
    const fileName = `termin_${appt.code || 'export'}.ics`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');

    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(blob, fileName);
      return;
    }

    const url = window.URL.createObjectURL(blob);
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 1000);
  } catch (err) {
    console.error('ICS Export Error:', err);
    // Fallback: Data URI download
    try {
      const icsContent = generateIcsContent(appt);
      const encodedData = encodeURIComponent(icsContent);
      const dataUri = `data:text/calendar;charset=utf-8,${encodedData}`;
      const link = document.createElement('a');
      link.href = dataUri;
      link.download = `termin_${appt.code || 'export'}.ics`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 1000);
    } catch (fallbackErr) {
      alert('Der Kalenderexport konnte leider nicht gestartet werden.');
    }
  }
}
