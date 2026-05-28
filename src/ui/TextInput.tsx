/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { JSX } from 'react';

import './Input.css';

import * as React from 'react';
import { HTMLInputTypeAttribute, useEffect, useState } from 'react';

type Props = Readonly<{
  'data-test-id'?: string;
  label: string;
  onChange: (val: string) => void;
  placeholder?: string;
  value: string;
  type?: HTMLInputTypeAttribute;
  endAdornment?: JSX.Element | null;
  helperText?: string | null;
}>;

const helperTextStyle: React.CSSProperties = {
  color: '#c0392b',
  fontSize: '0.75rem',
  overflow: 'hidden',
  transition: 'max-height 200ms ease, opacity 200ms ease, margin 200ms ease',
};

function HelperText({ message }: { message: string | null }): JSX.Element {
  const [visible, setVisible] = useState(false);
  const [displayed, setDisplayed] = useState<string | null>(null);

  useEffect(() => {
    if (message !== null) {
      setDisplayed(message);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const timer = setTimeout(() => setDisplayed(null), 200);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <p
      style={{
        ...helperTextStyle,
        maxHeight: visible ? '3rem' : '0',
        opacity: visible ? 1 : 0,
        margin: visible ? '4px 0 0' : '0',
      }}
      role="alert"
      aria-live="polite"
    >
      {displayed}
    </p>
  );
}

export default function TextInput({
  label,
  value,
  onChange,
  placeholder = '',
  'data-test-id': dataTestId,
  type = 'text',
  endAdornment = null,
  helperText = null,
}: Props): JSX.Element {
  return (
    <div className="Input__wrapper">
      <label className="Input__label">{label}</label>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 2,
          minWidth: 0,
        }}
      >
        <div
          className={
            endAdornment
              ? 'Input__container__with__endAdornment'
              : 'Input__container'
          }
        >
          <input
            type={type}
            className={
              endAdornment ? 'Input__input__with__endAdornment' : 'Input__input'
            }
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            data-test-id={dataTestId}
          />
          {endAdornment}
        </div>

        <HelperText message={helperText} />
      </div>
    </div>
  );
}
