'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';

const EXPO_OUT = [0.16, 1, 0.3, 1] as const;

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const DIAS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const HORARIOS = [
  '6:00 – 7:00 am', '7:00 – 8:00 am', '8:00 – 9:00 am',
  '9:00 – 10:00 am', '10:00 – 11:00 am', '4:00 – 5:00 pm', '5:00 – 6:00 pm',
];
const HORARIOS_SHORT = ['6:00am', '7:00am', '8:00am', '9:00am', '10:00am', '4:00pm', '5:00pm'];

export type CalSlot = {
  dia: string;
  horario: string;
  tipo: 'nutricion' | 'entrenamiento';
  estado: string;
  clientName?: string;
  isMine?: boolean;
};

export type WeeklyCalendarProps = {
  slots: CalSlot[];
  onSelectSlot?: (dia: string, horario: string) => void;
  selectedDia?: string;
  selectedHorario?: string;
  tipoFilter?: 'todas' | 'nutricion' | 'entrenamiento';
  showNames?: boolean;
  mode: 'view' | 'select';
};

export { DIAS, DIAS_SHORT, HORARIOS, HORARIOS_SHORT };

export default function WeeklyCalendar({
  slots,
  onSelectSlot,
  selectedDia,
  selectedHorario,
  tipoFilter = 'todas',
  showNames = false,
  mode,
}: WeeklyCalendarProps) {

  // Build lookup map: "dia|horario" -> CalSlot[]
  const slotMap = useMemo(() => {
    const map = new Map<string, CalSlot[]>();
    for (const s of slots) {
      if (tipoFilter !== 'todas' && s.tipo !== tipoFilter) continue;
      const key = `${s.dia}|${s.horario}`;
      const arr = map.get(key) || [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [slots, tipoFilter]);

  const getSlots = (dia: string, horario: string): CalSlot[] => {
    return slotMap.get(`${dia}|${horario}`) || [];
  };

  const isSelected = (dia: string, horario: string) => selectedDia === dia && selectedHorario === horario;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EXPO_OUT }}
    >
      {/* Scrollable grid wrapper */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '4px' }}>
        <table style={{
          width: '100%', minWidth: '520px', borderCollapse: 'separate', borderSpacing: '3px',
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
        }}>
          <thead>
            <tr>
              {/* Corner cell */}
              <th style={{
                width: '90px', minWidth: '90px', padding: '10px 8px',
                fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.18em',
                textTransform: 'uppercase', color: 'rgba(240,240,240,0.25)', textAlign: 'left',
                borderBottom: '1px solid #1A2418',
              }}>
                Hora
              </th>
              {DIAS.map((dia, i) => (
                <th key={dia} style={{
                  padding: '10px 6px',
                  fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.12em',
                  textTransform: 'uppercase', fontWeight: 600,
                  color: 'rgba(240,240,240,0.55)', textAlign: 'center',
                  borderBottom: '1px solid #1A2418',
                }}>
                  <span className="cal-dia-full">{dia}</span>
                  <span className="cal-dia-short">{DIAS_SHORT[i]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HORARIOS.map((horario, hi) => (
              <tr key={horario}>
                {/* Time label */}
                <td style={{
                  padding: '8px 8px',
                  fontFamily: 'var(--font-inter)', fontWeight: 500,
                  color: 'rgba(240,240,240,0.4)', textAlign: 'left',
                  verticalAlign: 'middle', whiteSpace: 'nowrap',
                }}>
                  <span className="cal-hora-full" style={{ fontSize: '12px' }}>{horario}</span>
                  <span className="cal-hora-short" style={{ fontSize: '11px' }}>{HORARIOS_SHORT[hi]}</span>
                </td>
                {DIAS.map((dia) => {
                  const cellSlots = getSlots(dia, horario);
                  const taken = cellSlots.length > 0;
                  const hasMine = cellSlots.some(s => s.isMine);
                  const selected = isSelected(dia, horario);
                  const hasNutricion = cellSlots.some(s => s.tipo === 'nutricion');
                  const hasEntrenamiento = cellSlots.some(s => s.tipo === 'entrenamiento');
                  const clickable = mode === 'select' && !taken;
                  const notClickable = mode === 'select' && taken;

                  // Determine cell style
                  let bg = '#0F1208';
                  let border = '1px solid #1E2A1C';
                  let opacity = 1;
                  let cursor: string = 'default';

                  if (selected) {
                    bg = 'rgba(40,180,74,0.15)';
                    border = '2px solid #28B44A';
                  } else if (hasMine) {
                    bg = 'rgba(240,120,32,0.2)';
                    border = '2px solid #F07820';
                  } else if (hasNutricion && hasEntrenamiento) {
                    bg = 'linear-gradient(135deg, rgba(240,120,32,0.12) 50%, rgba(40,180,74,0.1) 50%)';
                    border = '1px solid rgba(240,120,32,0.35)';
                  } else if (hasNutricion) {
                    bg = 'rgba(240,120,32,0.12)';
                    border = '1px solid rgba(240,120,32,0.4)';
                  } else if (hasEntrenamiento) {
                    bg = 'rgba(40,180,74,0.1)';
                    border = '1px solid rgba(40,180,74,0.35)';
                  }

                  if (clickable) cursor = 'pointer';
                  if (notClickable) { opacity = 0.5; cursor = 'not-allowed'; }

                  const useBgGradient = typeof bg === 'string' && bg.startsWith('linear');

                  return (
                    <td key={dia} style={{ padding: 0 }}>
                      <div
                        onClick={() => {
                          if (clickable && onSelectSlot) onSelectSlot(dia, horario);
                        }}
                        style={{
                          ...(useBgGradient ? { background: bg } : { backgroundColor: bg }),
                          border,
                          opacity,
                          cursor,
                          padding: '8px 6px',
                          minHeight: '42px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '3px',
                          transition: 'all 0.2s ease',
                          position: 'relative',
                        }}
                        onMouseEnter={(e) => {
                          if (clickable) {
                            e.currentTarget.style.borderColor = '#28B44A';
                            e.currentTarget.style.backgroundColor = 'rgba(40,180,74,0.08)';
                          }
                          if (mode === 'view' && taken && !hasMine && !selected) {
                            e.currentTarget.style.transform = 'scale(1.02)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (clickable) {
                            e.currentTarget.style.borderColor = '#1E2A1C';
                            e.currentTarget.style.backgroundColor = '#0F1208';
                          }
                          if (mode === 'view') {
                            e.currentTarget.style.transform = 'scale(1)';
                          }
                        }}
                      >
                        {/* Content */}
                        {taken ? (
                          <>
                            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                              {hasNutricion && (
                                <span style={{
                                  fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 700,
                                  color: '#F07820',
                                }}>N</span>
                              )}
                              {hasEntrenamiento && (
                                <span style={{
                                  fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 700,
                                  color: '#28B44A',
                                }}>E</span>
                              )}
                            </div>
                            {hasMine && (
                              <span style={{
                                fontFamily: 'var(--font-inter)', fontSize: '8px', letterSpacing: '0.08em',
                                textTransform: 'uppercase', color: '#F07820', fontWeight: 600,
                              }}>Mi cita</span>
                            )}
                            {showNames && cellSlots.map((s, si) => (
                              s.clientName ? (
                                <span key={si} style={{
                                  fontFamily: 'var(--font-inter)', fontSize: '9px',
                                  color: 'rgba(240,240,240,0.5)', lineHeight: 1,
                                }}>
                                  {s.clientName.charAt(0).toUpperCase()}
                                </span>
                              ) : null
                            ))}
                          </>
                        ) : mode === 'select' ? (
                          <span style={{
                            fontFamily: 'var(--font-inter)', fontSize: '9px',
                            color: 'rgba(240,240,240,0.2)',
                          }}>
                            —
                          </span>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '16px',
        padding: '14px 16px', backgroundColor: '#090C08', border: '1px solid #1A2418',
      }}>
        {[
          { color: '#0F1208', borderColor: '#1E2A1C', label: 'Disponible' },
          { color: 'rgba(240,120,32,0.12)', borderColor: 'rgba(240,120,32,0.4)', label: 'Nutricion (N)', textColor: '#F07820' },
          { color: 'rgba(40,180,74,0.1)', borderColor: 'rgba(40,180,74,0.35)', label: 'Entrenamiento (E)', textColor: '#28B44A' },
          { color: 'rgba(240,120,32,0.2)', borderColor: '#F07820', label: 'Mi cita', textColor: '#F07820' },
          { color: 'rgba(40,180,74,0.15)', borderColor: '#28B44A', label: 'Seleccionado', textColor: '#28B44A' },
        ].map(({ color, borderColor, label, textColor }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '14px', height: '14px', backgroundColor: color,
              border: `1.5px solid ${borderColor}`, flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.06em',
              color: textColor || 'rgba(240,240,240,0.45)',
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Responsive CSS */}
      <style>{`
        .cal-dia-short { display: none; }
        .cal-hora-short { display: none; }
        @media (max-width: 600px) {
          .cal-dia-full { display: none !important; }
          .cal-dia-short { display: inline !important; }
          .cal-hora-full { display: none !important; }
          .cal-hora-short { display: inline !important; }
        }
      `}</style>
    </motion.div>
  );
}
