import React, { useState, useEffect } from 'react';
import { ThemeColors, Language } from '../types';
import { TEXT } from '../constants/theme';
import { exportColorMarkdown } from '../utils/dataProcessor';

interface ModalsProps {
  dialog: { isOpen: boolean; title: string; message: string };
  onCloseDialog: () => void;
  isDriveOpen: boolean;
  onCloseDrive: () => void;
  onLoadDrive: (url: string) => void;
  isCustomColorOpen: boolean;
  onCloseCustomColor: () => void;
  currentPalette: ThemeColors;
  onApplyCustomColors: (colors: ThemeColors) => void;
  lang: Language;
}

export const Modals: React.FC<ModalsProps> = ({
  dialog,
  onCloseDialog,
  isDriveOpen,
  onCloseDrive,
  onLoadDrive,
  isCustomColorOpen,
  onCloseCustomColor,
  currentPalette,
  onApplyCustomColors,
  lang,
}) => {
  const t = TEXT[lang];
  const [driveUrl, setDriveUrl] = useState(
    'https://script.google.com/macros/s/AKfycbww91fgTQIYG-dngmp0J8qe9-Nzt9QpG8qVCY7lWaYrV31CWJ8ZbqugPY8qTbAP2LKxRA/exec'
  );

  const [customColors, setCustomColors] = useState<ThemeColors>({ ...currentPalette });

  useEffect(() => {
    setCustomColors({ ...currentPalette });
  }, [currentPalette, isCustomColorOpen]);

  const handleColorChange = (key: keyof ThemeColors, val: string) => {
    setCustomColors(prev => ({ ...prev, [key]: val }));
  };

  return (
    <>
      {/* Dialog Notice Modal */}
      {dialog.isOpen && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal-box">
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--brand-negative)', lineHeight: 1.2 }}>
              {dialog.title}
            </h3>
            <p
              className="text-sm mb-4"
              style={{ color: 'var(--text-main)' }}
              dangerouslySetInnerHTML={{ __html: dialog.message }}
            ></p>
            <div className="flex justify-end">
              <button
                onClick={onCloseDialog}
                className="px-4 py-2 rounded text-xs font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--brand-main)' }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive / Web App Modal */}
      {isDriveOpen && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal-box">
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-main)', lineHeight: 1.2 }}>
              {lang === 'en' ? 'Connect Data via Web App' : '透過 Web 應用程式載入資料'}
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-sub)' }}>
              {lang === 'en' ? (
                <>Please paste your <b>Google Apps Script Web App URL</b>.</>
              ) : (
                <>請貼上您的 <b>Google Apps Script Web App URL</b>。</>
              )}
            </p>
            <input
              className="std-input mb-4"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={onCloseDrive}
                className="px-4 py-2 rounded text-xs font-bold"
                style={{ color: 'var(--text-sub)' }}
              >
                {t.lblBtnCancel}
              </button>
              <button
                onClick={() => onLoadDrive(driveUrl.trim())}
                className="px-4 py-2 rounded text-xs font-bold text-white shadow-sm"
                style={{ backgroundColor: 'var(--brand-main)' }}
              >
                {lang === 'en' ? 'Load Data' : '載入資料'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Colors Modal */}
      {isCustomColorOpen && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal-box modal-box-lg">
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-main)', lineHeight: 1.2 }}>
              {t.lblModalTitle}
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-sub)' }}>
              {t.lblModalSub}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2 mb-4">
              {/* Backgrounds & Borders */}
              <div>
                <h4
                  className="text-xs font-bold uppercase mb-3 border-b pb-1"
                  style={{ color: 'var(--brand-sub)', borderColor: 'var(--border-color)', lineHeight: 1.2 }}
                >
                  {t.lblBgGroup}
                </h4>
                <div className="color-input-group">
                  <div className="input-labels">
                    <label>{t.lblBgPage}</label>
                    <p>{t.descBgPage}</p>
                  </div>
                  <input
                    type="color"
                    value={customColors.bg}
                    onChange={(e) => handleColorChange('bg', e.target.value)}
                    className="color-preview"
                  />
                  <input
                    type="text"
                    value={customColors.bg}
                    onChange={(e) => handleColorChange('bg', e.target.value)}
                    className="std-input color-hex"
                  />
                </div>
                <div className="color-input-group">
                  <div className="input-labels">
                    <label>{t.lblBgCard}</label>
                    <p>{t.descBgCard}</p>
                  </div>
                  <input
                    type="color"
                    value={customColors.card}
                    onChange={(e) => handleColorChange('card', e.target.value)}
                    className="color-preview"
                  />
                  <input
                    type="text"
                    value={customColors.card}
                    onChange={(e) => handleColorChange('card', e.target.value)}
                    className="std-input color-hex"
                  />
                </div>
                <div className="color-input-group">
                  <div className="input-labels">
                    <label>{t.lblBgBorder}</label>
                    <p>{t.descBgBorder}</p>
                  </div>
                  <input
                    type="color"
                    value={customColors.border}
                    onChange={(e) => handleColorChange('border', e.target.value)}
                    className="color-preview"
                  />
                  <input
                    type="text"
                    value={customColors.border}
                    onChange={(e) => handleColorChange('border', e.target.value)}
                    className="std-input color-hex"
                  />
                </div>
              </div>

              {/* Typography */}
              <div>
                <h4
                  className="text-xs font-bold uppercase mb-3 border-b pb-1"
                  style={{ color: 'var(--brand-sub)', borderColor: 'var(--border-color)', lineHeight: 1.2 }}
                >
                  {t.lblTextGroup}
                </h4>
                <div className="color-input-group">
                  <div className="input-labels">
                    <label>{t.lblTxtMain}</label>
                    <p>{t.descTxtMain}</p>
                  </div>
                  <input
                    type="color"
                    value={customColors.textMain}
                    onChange={(e) => handleColorChange('textMain', e.target.value)}
                    className="color-preview"
                  />
                  <input
                    type="text"
                    value={customColors.textMain}
                    onChange={(e) => handleColorChange('textMain', e.target.value)}
                    className="std-input color-hex"
                  />
                </div>
                <div className="color-input-group">
                  <div className="input-labels">
                    <label>{t.lblTxtSub}</label>
                    <p>{t.descTxtSub}</p>
                  </div>
                  <input
                    type="color"
                    value={customColors.textSub}
                    onChange={(e) => handleColorChange('textSub', e.target.value)}
                    className="color-preview"
                  />
                  <input
                    type="text"
                    value={customColors.textSub}
                    onChange={(e) => handleColorChange('textSub', e.target.value)}
                    className="std-input color-hex"
                  />
                </div>
                <div className="color-input-group">
                  <div className="input-labels">
                    <label>{t.lblTxtBlue}</label>
                    <p>{t.descTxtBlue}</p>
                  </div>
                  <input
                    type="color"
                    value={customColors.blue}
                    onChange={(e) => handleColorChange('blue', e.target.value)}
                    className="color-preview"
                  />
                  <input
                    type="text"
                    value={customColors.blue}
                    onChange={(e) => handleColorChange('blue', e.target.value)}
                    className="std-input color-hex"
                  />
                </div>
              </div>

              {/* Brand & Chart Palette */}
              <div>
                <h4
                  className="text-xs font-bold uppercase mb-3 border-b pb-1"
                  style={{ color: 'var(--brand-sub)', borderColor: 'var(--border-color)', lineHeight: 1.2 }}
                >
                  {t.lblBrandGroup}
                </h4>
                <div className="color-input-group">
                  <div className="input-labels">
                    <label>{t.lblBrandMain}</label>
                    <p>{t.descBrandMain}</p>
                  </div>
                  <input
                    type="color"
                    value={customColors.main}
                    onChange={(e) => {
                      handleColorChange('main', e.target.value);
                      handleColorChange('textBrand', e.target.value);
                    }}
                    className="color-preview"
                  />
                  <input
                    type="text"
                    value={customColors.main}
                    onChange={(e) => {
                      handleColorChange('main', e.target.value);
                      handleColorChange('textBrand', e.target.value);
                    }}
                    className="std-input color-hex"
                  />
                </div>
                <div className="color-input-group">
                  <div className="input-labels">
                    <label>{t.lblBrandSub}</label>
                    <p>{t.descBrandSub}</p>
                  </div>
                  <input
                    type="color"
                    value={customColors.sub}
                    onChange={(e) => handleColorChange('sub', e.target.value)}
                    className="color-preview"
                  />
                  <input
                    type="text"
                    value={customColors.sub}
                    onChange={(e) => handleColorChange('sub', e.target.value)}
                    className="std-input color-hex"
                  />
                </div>
                <div className="color-input-group">
                  <div className="input-labels">
                    <label>{t.lblBrandAccent}</label>
                    <p>{t.descBrandAccent}</p>
                  </div>
                  <input
                    type="color"
                    value={customColors.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="color-preview"
                  />
                  <input
                    type="text"
                    value={customColors.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="std-input color-hex"
                  />
                </div>
              </div>

              {/* Status Indication */}
              <div>
                <h4
                  className="text-xs font-bold uppercase mb-3 border-b pb-1"
                  style={{ color: 'var(--brand-sub)', borderColor: 'var(--border-color)', lineHeight: 1.2 }}
                >
                  {t.lblStatusGroup}
                </h4>
                <div className="color-input-group">
                  <div className="input-labels">
                    <label>{t.lblStatusPos}</label>
                    <p>{t.descStatusPos}</p>
                  </div>
                  <input
                    type="color"
                    value={customColors.positive}
                    onChange={(e) => handleColorChange('positive', e.target.value)}
                    className="color-preview"
                  />
                  <input
                    type="text"
                    value={customColors.positive}
                    onChange={(e) => handleColorChange('positive', e.target.value)}
                    className="std-input color-hex"
                  />
                </div>
                <div className="color-input-group">
                  <div className="input-labels">
                    <label>{t.lblStatusNeg}</label>
                    <p>{t.descStatusNeg}</p>
                  </div>
                  <input
                    type="color"
                    value={customColors.negative}
                    onChange={(e) => handleColorChange('negative', e.target.value)}
                    className="color-preview"
                  />
                  <input
                    type="text"
                    value={customColors.negative}
                    onChange={(e) => handleColorChange('negative', e.target.value)}
                    className="std-input color-hex"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center border-t pt-4 mt-2" style={{ borderColor: 'var(--border-color)' }}>
              <button
                onClick={() => exportColorMarkdown(customColors as any)}
                className="px-4 py-2 rounded text-xs font-bold transition-all hover:opacity-70 flex items-center gap-1"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.05)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <i className="fa-solid fa-file-export mr-1"></i> {t.lblBtnExportMd}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onCloseCustomColor}
                  className="px-4 py-2 rounded text-xs font-bold transition-all hover:bg-gray-100"
                  style={{ color: 'var(--text-sub)' }}
                >
                  {t.lblBtnCancel}
                </button>
                <button
                  onClick={() => onApplyCustomColors(customColors)}
                  className="px-4 py-2 rounded text-xs font-bold text-white transition-all hover:opacity-90 shadow-sm"
                  style={{ backgroundColor: 'var(--brand-main)' }}
                >
                  {t.lblBtnApply}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
