import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { colors, font, radius, shadow } from '../theme';

type Value = 'ok' | 'nok' | 'na';

interface Props {
  value: Value | null;
  onChange: (v: Value) => void;
  disabled?: boolean;
}

const CONFIG = {
  ok: { label: 'OK', icon: 'check-circle' as const, color: colors.success, soft: colors.successSoft },
  nok: { label: 'NOK', icon: 'x-circle' as const, color: colors.danger, soft: colors.dangerSoft },
  na: { label: 'N/A', icon: 'minus-circle' as const, color: colors.gray[400], soft: colors.gray[100] },
};

export default function AnswerChips({ value, onChange, disabled }: Props) {
  return (
    <View style={styles.row}>
      {(['ok', 'nok', 'na'] as Value[]).map((v) => {
        const cfg = CONFIG[v];
        const active = value === v;
        return (
          <TouchableOpacity
            key={v}
            disabled={disabled}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(v);
            }}
            activeOpacity={0.85}
            style={[
              styles.chip,
              { borderColor: colors.gray[200] },
              active && {
                backgroundColor: cfg.color,
                borderColor: cfg.color,
                ...shadow.colored(cfg.color),
              },
            ]}
          >
            <Feather
              name={cfg.icon}
              size={16}
              color={active ? colors.white : cfg.color}
            />
            <Text style={[
              styles.label,
              { color: active ? colors.white : colors.gray[500] },
              active && { fontFamily: font.bold },
            ]}>
              {cfg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: colors.white,
  },
  label: {
    fontSize: 13,
    fontFamily: font.extrabold,
    letterSpacing: 0.8,
  },
});
