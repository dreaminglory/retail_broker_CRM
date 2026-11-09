import { describe, expect, it } from 'vitest';
import { detectHeaders } from './header-detection';

// Pins the contact and inquiry auto-mapping as it was before property import (AD-064):
// adding the property dictionary must not change these results.
const CONTACT_AND_INQUIRY_HEADER_SETS = [
  ['Име', 'Фамилия', 'Телефон', 'Имейл', 'Фирма', 'Бележка', 'ID'],
  ['Full name', 'Phone', 'Email', 'Company', 'Notes', 'Reference', 'Type'],
  ['Пълно име', 'Тел', 'Е-поща', 'Тип', 'Номер', 'Viber', 'WhatsApp', 'Телефон 2'],
  ['Име', 'Телефон', 'Имейл', 'Тема', 'Описание', 'Източник', 'Референция', 'Дата', 'Брокер', 'Статус'],
  ['Caller name', 'Caller phone', 'Caller email', 'Subject', 'Description', 'Source', 'External ref', 'Received at', 'Assigned to', 'Status'],
];

describe('detectHeaders: contact and inquiry mapping is pinned', () => {
  it('maps contact headers as before', () => {
    expect(CONTACT_AND_INQUIRY_HEADER_SETS.map((h) => detectHeaders(h, 'contact'))).toMatchSnapshot();
  });

  it('maps inquiry headers as before', () => {
    expect(CONTACT_AND_INQUIRY_HEADER_SETS.map((h) => detectHeaders(h, 'inquiry'))).toMatchSnapshot();
  });
});

describe('detectHeaders: property', () => {
  it('maps every spec column from a Bulgarian header row', () => {
    const headers = [
      'Тип имот', 'Населено място', 'Община', 'Област', 'Квартал', 'Адрес', 'Ориентир',
      'Брой стаи', 'Квадратура', 'Площ на парцела', 'Етаж', 'Етажност', 'Година на строителство',
      'Строителство', 'Продажна цена', 'Цена наем', 'Статус', 'Дата на обява', 'Брокер',
      'Описание', 'Реф. номер', 'Собственик', 'Телефон на собственика', 'Имейл на собственика',
    ];
    expect(detectHeaders(headers, 'property')).toEqual({
      type: 'Тип имот',
      settlement: 'Населено място',
      municipality: 'Община',
      province: 'Област',
      area: 'Квартал',
      address: 'Адрес',
      location_note: 'Ориентир',
      rooms: 'Брой стаи',
      area_m2: 'Квадратура',
      plot_m2: 'Площ на парцела',
      floor: 'Етаж',
      floors_total: 'Етажност',
      year_built: 'Година на строителство',
      construction: 'Строителство',
      sale_price: 'Продажна цена',
      rent_price: 'Цена наем',
      listing_status: 'Статус',
      listed_at: 'Дата на обява',
      assigned_to: 'Брокер',
      description: 'Описание',
      external_ref: 'Реф. номер',
      owner_name: 'Собственик',
      owner_phone: 'Телефон на собственика',
      owner_email: 'Имейл на собственика',
    });
  });

  it('maps English headers', () => {
    const headers = ['Type', 'City', 'Area', 'Address', 'Rooms', 'Area m2', 'Floor', 'Total floors',
      'Sale price', 'Rent price', 'Owner', 'Owner phone', 'Owner email', 'ID'];
    expect(detectHeaders(headers, 'property')).toEqual({
      type: 'Type', settlement: 'City', area: 'Area', address: 'Address', rooms: 'Rooms',
      area_m2: 'Area m2', floor: 'Floor', floors_total: 'Total floors', sale_price: 'Sale price',
      rent_price: 'Rent price', owner_name: 'Owner', owner_phone: 'Owner phone',
      owner_email: 'Owner email', external_ref: 'ID',
    });
  });

  it('leaves a header that names two fields unmapped instead of picking by order', () => {
    const mapping = detectHeaders(
      ['Телефон на брокера', 'Broker email', 'Описание на квартала', 'Телефон на собственика', 'Квартал'],
      'property'
    );
    expect(mapping).toEqual({ owner_phone: 'Телефон на собственика', area: 'Квартал' });
  });

  it('maps a header whose longer synonym contains the other match', () => {
    expect(detectHeaders(['Година на строителство (г.)', 'Цена наем (EUR)', 'Имейл адрес'], 'property')).toEqual({
      year_built: 'Година на строителство (г.)',
      rent_price: 'Цена наем (EUR)',
      owner_email: 'Имейл адрес',
    });
  });

  it('does not use contact or inquiry fields for a property file', () => {
    const mapping = detectHeaders(['Име', 'Тема', 'Източник'], 'property');
    expect(Object.keys(mapping)).not.toContain('first_name');
    expect(Object.keys(mapping)).not.toContain('subject');
  });
});
