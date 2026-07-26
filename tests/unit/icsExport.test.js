import { describe, it, expect, vi } from 'vitest';
import { generateIcsContent, parseApptDateTime, exportAppointmentToIcs } from '../../src/utils/icsExport.js';

describe('icsExport utility', () => {
  it('should parse YYYY-MM-DD date and time correctly', () => {
    const dt = parseApptDateTime('2026-08-15', '10:30');
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(7); // 0-indexed: 7 is August
    expect(dt.getDate()).toBe(15);
    expect(dt.getHours()).toBe(10);
    expect(dt.getMinutes()).toBe(30);
  });

  it('should parse German date format correctly', () => {
    const dt = parseApptDateTime('15. Aug 2026', '14:15');
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(7);
    expect(dt.getDate()).toBe(15);
    expect(dt.getHours()).toBe(14);
    expect(dt.getMinutes()).toBe(15);
  });

  it('should generate valid .ics calendar content with required fields and privacy compliance', () => {
    const appt = {
      code: 'TEST1234',
      praxis: 'Hausarztpraxis Musterstadt',
      doctor: 'Dr. Med. Test',
      fachrichtung: 'Allgemeinmedizin',
      adresse: 'Musterstraße 42, 12345 Berlin',
      date: '2026-08-15',
      time: '10:00',
      duration_minutes: 30
    };

    const ics = generateIcsContent(appt);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Arzttermin: Hausarztpraxis Musterstadt (Dr. Med. Test)');
    expect(ics).toContain('LOCATION:Musterstraße 42, 12345 Berlin');
    expect(ics).toContain('DESCRIPTION:Praxis: Hausarztpraxis Musterstadt\\nHinweis: Bitte bringen Sie Ihre Versichertenkarte mit.');
    expect(ics).toContain('UID:termin-TEST1234@doctolib-precheckin');
    
    // Ensure no medical details or diagnoses are present
    expect(ics).not.toContain('Diagnose');
    expect(ics).not.toContain('Beschwerden');
  });

  it('should trigger browser file download when exportAppointmentToIcs is invoked', () => {
    const appt = {
      code: 'TEST5678',
      praxis: 'Test Praxis',
      date: '2026-09-01',
      time: '11:00'
    };

    const createObjectURLMock = vi.fn().mockReturnValue('blob:test');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    const realAnchor = document.createElement('a');
    const clickSpy = vi.spyOn(realAnchor, 'click').mockImplementation(() => {});
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(realAnchor);

    exportAppointmentToIcs(appt);

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });
});
