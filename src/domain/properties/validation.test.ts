import { describe, expect, it } from 'vitest';
import { propertyFieldsFor, propertyFormSchema } from './validation';

const SETTLEMENT_ID = '11111111-1111-4111-8111-111111111111';
const AREA_ID = '22222222-2222-4222-8222-222222222222';

function parse(input: Record<string, unknown>) {
  return propertyFormSchema.safeParse({ settlement_id: SETTLEMENT_ID, ...input });
}

function firstError(input: Record<string, unknown>) {
  const result = parse(input);
  if (result.success) return undefined;
  const [issue] = result.error.issues;
  return { path: issue.path.join('.'), message: issue.message };
}

describe('propertyFormSchema (rule 3)', () => {
  it('accepts the AC-1 apartment from form strings', () => {
    const result = parse({ type: 'apartment', rooms: '2', area_m2: '68', area_id: AREA_ID, floor: '3', floors_total: '8' });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'apartment', rooms: 2, area_m2: 68, floor: 3, floors_total: 8, area_id: AREA_ID });
  });

  it('needs rooms for an apartment', () => {
    expect(firstError({ type: 'apartment', rooms: '' })).toEqual({ path: 'rooms', message: 'validation.rooms_required' });
  });

  it('keeps apartment rooms within 1-9', () => {
    expect(firstError({ type: 'apartment', rooms: '10' })?.path).toBe('rooms');
    expect(firstError({ type: 'apartment', rooms: '0' })?.path).toBe('rooms');
  });

  it('needs the plot area for a plot', () => {
    expect(firstError({ type: 'plot', plot_m2: '' })).toEqual({ path: 'plot_m2', message: 'validation.plot_m2_required' });
  });

  it('refuses a floor above the building', () => {
    expect(firstError({ type: 'studio', floor: '9', floors_total: '8' })).toEqual({
      path: 'floor',
      message: 'validation.floor_above_total',
    });
  });

  it('reports every rule 3 error at once, even without a settlement', () => {
    const result = propertyFormSchema.safeParse({ type: 'apartment', rooms: '', floor: '9', floors_total: '8', settlement_id: '' });
    expect(result.error?.flatten().fieldErrors).toEqual({
      settlement_id: ['validation.settlement_required'],
      rooms: ['validation.rooms_required'],
      floor: ['validation.floor_above_total'],
    });
  });

  it('drops the fields a type does not have, so hidden inputs never save', () => {
    const plot = parse({ type: 'plot', plot_m2: '600', rooms: '3', floor: '2', area_m2: '90' });
    expect(plot.data).toMatchObject({ rooms: null, floor: null, area_m2: null, plot_m2: 600 });

    const studio = parse({ type: 'studio', rooms: '2', plot_m2: '100' });
    expect(studio.data).toMatchObject({ rooms: null, plot_m2: null });
  });

  it('needs a settlement and maps empty optional fields to null', () => {
    expect(firstError({ type: 'garage', settlement_id: '' })?.message).toBe('validation.settlement_required');
    expect(parse({ type: 'garage', area_id: '', address: '  ', assigned_to: 'none' }).data).toMatchObject({
      area_id: null,
      address: null,
      assigned_to: null,
    });
    expect(parse({ type: 'house', construction: 'none' }).data).toMatchObject({ construction: null });
  });

  it('refuses a non-positive area and an unknown construction', () => {
    expect(firstError({ type: 'garage', area_m2: '0' })?.path).toBe('area_m2');
    expect(firstError({ type: 'house', construction: 'straw' })?.path).toBe('construction');
  });
});

describe('propertyFieldsFor', () => {
  it('shows rooms only for apartments and the plot area for plots and houses', () => {
    expect(propertyFieldsFor('apartment')).toMatchObject({ rooms: true, plot_m2: false, floor: true });
    expect(propertyFieldsFor('house')).toMatchObject({ rooms: false, plot_m2: true, floor: false });
    expect(propertyFieldsFor('plot')).toMatchObject({ rooms: false, plot_m2: true, floor: false, area_m2: false });
  });
});
