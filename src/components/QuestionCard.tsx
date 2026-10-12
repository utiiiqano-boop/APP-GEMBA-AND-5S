import React from 'react';
import { View, Text, TextInput, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { colors, font, radius, shadow, spacing } from '../theme';
import AnswerChips from './AnswerChips';

type Value = 'ok' | 'nok' | 'na';

interface Props {
  index: number;
  total: number;
  category: string;
  title: string;
  criteria?: string[];
  answer: Value | null;
  comment: string;
  pilot: string;
  dueDate: string;
  imageUrl?: string | null;
  error?: string;
  uploading?: boolean;
  onChangeAnswer: (v: Value) => void;
  onChangeComment: (t: string) => void;
  onChangePilot: (t: string) => void;
  onChangeDueDate: (t: string) => void;
  onPickImage: () => void;
  onRemoveImage: () => void;
  onBlurSave: () => void;
}

export default function QuestionCard({
  index, total, category, title, criteria = [],
  answer, comment, pilot, dueDate, imageUrl, error, uploading,
  onChangeAnswer, onChangeComment, onChangePilot, onChangeDueDate,
  onPickImage, onRemoveImage, onBlurSave,
}: Props) {
  const isNok = answer === 'nok';

  return (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(400)} style={styles.card}>
      {/* Header */}
      <View style={styles.head}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{category}</Text>
        </View>
        <Text style={styles.index}>Q{index + 1}/{total}</Text>
      </View>

      <Text style={styles.title}>{title}</Text>

      {criteria.length > 0 && (
        <View style={styles.criteriaBox}>
          {criteria.map((c, i) => (
            <View key={i} style={styles.criterion}>
              <View style={styles.bullet} />
              <Text style={styles.criterionText}>{c}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Answer chips */}
      <Text style={styles.sectionLabel}>VOTRE RÉPONSE</Text>
      <AnswerChips value={answer} onChange={onChangeAnswer} />

      {/* Commentaire */}
      <Text style={styles.sectionLabel}>
        COMMENTAIRE
        {isNok && <Text style={styles.required}> — OBLIGATOIRE</Text>}
      </Text>
      <TextInput
        placeholder={isNok ? 'Expliquez le problème constaté…' : 'Ajoutez un commentaire si nécessaire…'}
        placeholderTextColor={colors.gray[400]}
        value={comment}
        onChangeText={onChangeComment}
        onBlur={onBlurSave}
        multiline
        style={[
          styles.input,
          styles.textarea,
          isNok && !comment.trim() && error ? styles.inputError : null,
        ]}
      />

      {/* Pilote + Date */}
      <View style={styles.grid2}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>
            PILOTE{isNok && <Text style={styles.required}> *</Text>}
          </Text>
          <TextInput
            placeholder="Nom"
            placeholderTextColor={colors.gray[400]}
            value={pilot}
            onChangeText={onChangePilot}
            onBlur={onBlurSave}
            style={[styles.input, isNok && !pilot.trim() && error ? styles.inputError : null]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>
            DATE PRÉVUE{isNok && <Text style={styles.required}> *</Text>}
          </Text>
          <TextInput
            placeholder="AAAA-MM-JJ"
            placeholderTextColor={colors.gray[400]}
            value={dueDate}
            onChangeText={onChangeDueDate}
            onBlur={onBlurSave}
            style={[styles.input, isNok && !dueDate.trim() && error ? styles.inputError : null]}
          />
        </View>
      </View>

      {/* Photo */}
      {isNok && (
        <>
          <Text style={styles.sectionLabel}>
            PHOTO<Text style={styles.required}> — OBLIGATOIRE POUR NOK</Text>
          </Text>
          {imageUrl ? (
            <View style={styles.imageBox}>
              <Image source={{ uri: imageUrl }} style={styles.image} />
              <View style={styles.imageActions}>
                <TouchableOpacity style={styles.imageBtn} onPress={onPickImage}>
                  <Feather name="refresh-cw" size={14} color={colors.primary} />
                  <Text style={[styles.imageBtnText, { color: colors.primary }]}>Remplacer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.imageBtn, { backgroundColor: colors.dangerSoft }]} onPress={onRemoveImage}>
                  <Feather name="trash-2" size={14} color={colors.danger} />
                  <Text style={[styles.imageBtnText, { color: colors.danger }]}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBtn} onPress={onPickImage} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Feather name="camera" size={22} color={colors.primary} />
                  <Text style={styles.uploadText}>Ajouter une photo</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={14} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.md,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  chip: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  chipText: {
    fontSize: 10,
    fontFamily: font.extrabold,
    color: colors.primary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  index: { fontSize: 11, fontFamily: font.bold, color: colors.gray[400], letterSpacing: 1 },
  title: { fontSize: 16, fontFamily: font.extrabold, color: colors.gray[900], lineHeight: 22, marginBottom: spacing.md },

  criteriaBox: {
    backgroundColor: colors.gray[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  criterion: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  bullet: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8, marginRight: 10,
  },
  criterionText: { flex: 1, fontSize: 13, fontFamily: font.regular, color: colors.gray[600], lineHeight: 19 },

  sectionLabel: {
    fontSize: 10,
    fontFamily: font.extrabold,
    color: colors.gray[400],
    letterSpacing: 1.8,
    marginTop: spacing.md,
    marginBottom: 8,
  },
  required: { color: colors.danger },

  input: {
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    backgroundColor: colors.gray[50],
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: font.medium,
    color: colors.gray[900],
  },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },

  grid2: { flexDirection: 'row', gap: 12 },

  uploadBtn: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primarySoft,
  },
  uploadText: { color: colors.primary, fontFamily: font.bold, fontSize: 13 },

  imageBox: {},
  image: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.gray[100] },
  imageActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  imageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  imageBtnText: { fontFamily: font.bold, fontSize: 12 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerSoft,
    padding: 10,
    borderRadius: radius.sm,
    marginTop: 10,
  },
  errorText: { color: colors.danger, fontFamily: font.semibold, fontSize: 12, flex: 1 },
});
