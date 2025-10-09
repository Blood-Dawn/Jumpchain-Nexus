/*
MIT License

Copyright (c) 2025 Age-Of-Ages

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import React, { useEffect, useMemo, useState } from "react";
import {
  deleteCharacterProfile,
  listCharacterProfiles,
  type CharacterProfileRecord,
  type UpsertCharacterProfileInput,
  upsertCharacterProfile,
} from "../../db/dao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface AttributeEntry {
  id: string;
  key: string;
  value: string;
}

interface TraitEntry {
  id: string;
  name: string;
  description: string;
}

interface AltFormEntry {
  id: string;
  name: string;
  summary: string;
}

interface ProfileFormState {
  id: string | null;
  name: string;
  alias: string;
  species: string;
  homeland: string;
  biography: string;
  notes: string;
  attributes: AttributeEntry[];
  traits: TraitEntry[];
  altForms: AltFormEntry[];
}

const createLocalId = () => Math.random().toString(36).slice(2, 10);

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return (parsed ?? fallback) as T;
  } catch (error) {
    console.warn("Failed to parse JSON column", error);
    return fallback;
  }
}

function toFormState(record: CharacterProfileRecord): ProfileFormState {
  const attributesMap = safeParse<Record<string, string | number>>(record.attributes_json, {});
  const traitsArray = safeParse<Array<{ name: string; description?: string }>>(record.traits_json, []);
  const altFormsArray = safeParse<Array<{ name: string; summary?: string }>>(record.alt_forms_json, []);
  return {
    id: record.id,
    name: record.name ?? "",
    alias: record.alias ?? "",
    species: record.species ?? "",
    homeland: record.homeland ?? "",
    biography: record.biography ?? "",
    notes: record.notes ?? "",
    attributes: Object.entries(attributesMap).map(([key, value]) => ({
      id: createLocalId(),
      key,
      value: String(value ?? ""),
    })),
    traits: traitsArray.map((trait) => ({
      id: createLocalId(),
      name: trait.name ?? "",
      description: trait.description ?? "",
    })),
    altForms: altFormsArray.map((alt) => ({
      id: createLocalId(),
      name: alt.name ?? "",
      summary: alt.summary ?? "",
    })),
  };
}

const DerivedSummary: React.FC<{ form: ProfileFormState | null }> = ({ form }) => {
  const summary = useMemo(() => {
    if (!form) {
      return { attributeTotal: 0, attributeAverage: 0, altFormCount: 0, traitCount: 0 };
    }
    const numericValues = form.attributes
      .map((entry) => Number(entry.value))
      .filter((value) => Number.isFinite(value));
    const total = numericValues.reduce((acc, value) => acc + value, 0);
    const average = numericValues.length ? total / numericValues.length : 0;
    const altFormCount = form.altForms.filter((formEntry) => formEntry.name.trim().length > 0).length;
    const traitCount = form.traits.filter((trait) => trait.name.trim().length > 0).length;
    return {
      attributeTotal: Math.round(total * 100) / 100,
      attributeAverage: Math.round(average * 100) / 100,
      altFormCount,
      traitCount,
    };
  }, [form]);

  return (
    <div className="passport__summary">
      <div>
        <strong>Attribute Sum</strong>
        <span>{summary.attributeTotal}</span>
      </div>
      <div>
        <strong>Average Score</strong>
        <span>{summary.attributeAverage}</span>
      </div>
      <div>
        <strong>Alt Forms</strong>
        <span>{summary.altFormCount}</span>
      </div>
      <div>
        <strong>Traits</strong>
        <span>{summary.traitCount}</span>
      </div>
    </div>
  );
};

const CosmicPassport: React.FC = () => {
  const queryClient = useQueryClient();
  const profilesQuery = useQuery({ queryKey: ["passport-profiles"], queryFn: listCharacterProfiles });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProfileFormState | null>(null);

  useEffect(() => {
    if (!profilesQuery.data?.length) {
      setSelectedId(null);
      setFormState(null);
      return;
    }
    if (!selectedId || !profilesQuery.data.some((profile) => profile.id === selectedId)) {
      setSelectedId(profilesQuery.data[0].id);
    }
  }, [profilesQuery.data, selectedId]);

  const selectedProfile = useMemo(
    () => profilesQuery.data?.find((profile) => profile.id === selectedId) ?? null,
    [profilesQuery.data, selectedId]
  );

  useEffect(() => {
    if (selectedProfile) {
      setFormState(toFormState(selectedProfile));
    }
  }, [selectedProfile?.id, selectedProfile?.updated_at]);

  const upsertMutation = useMutation({
    mutationFn: (input: UpsertCharacterProfileInput) => upsertCharacterProfile(input),
    onSuccess: (profile) => {
      setSelectedId(profile.id);
      setFormState(toFormState(profile));
      queryClient.invalidateQueries({ queryKey: ["passport-profiles"] }).catch(() => undefined);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCharacterProfile(id),
    onSuccess: () => {
      setSelectedId(null);
      setFormState(null);
      queryClient.invalidateQueries({ queryKey: ["passport-profiles"] }).catch(() => undefined);
    },
  });

  const handleCreate = async () => {
    const label = `Traveler ${profilesQuery.data ? profilesQuery.data.length + 1 : 1}`;
    await upsertMutation.mutateAsync({
      name: label,
      alias: null,
      species: null,
      homeland: null,
      biography: "",
      notes: "",
  attributes: {},
  traits: JSON.stringify([]),
  alt_forms: JSON.stringify([]),
    });
  };

  const handleSave = () => {
    if (!formState) return;
    const attributesObject = Object.fromEntries(
      formState.attributes
        .filter((entry) => entry.key.trim().length > 0)
        .map((entry) => [entry.key.trim(), entry.value])
    );
    const traitsArray = formState.traits
      .filter((entry) => entry.name.trim().length > 0)
      .map((entry) => ({ name: entry.name.trim(), description: entry.description.trim() }));
    const altFormsArray = formState.altForms
      .filter((entry) => entry.name.trim().length > 0)
      .map((entry) => ({ name: entry.name.trim(), summary: entry.summary.trim() }));

    const payload: UpsertCharacterProfileInput = {
      id: formState.id ?? undefined,
      name: formState.name.trim() || "Unnamed Traveler",
      alias: formState.alias.trim() || null,
      species: formState.species.trim() || null,
      homeland: formState.homeland.trim() || null,
      biography: formState.biography.trim() || null,
      notes: formState.notes.trim() || null,
      attributes: attributesObject,
  traits: JSON.stringify(traitsArray),
  alt_forms: JSON.stringify(altFormsArray),
    };
    upsertMutation.mutate(payload);
  };

  const handleDelete = () => {
    if (selectedId) {
      deleteMutation.mutate(selectedId);
    }
  };

  const mutateAttributes = (updater: (current: AttributeEntry[]) => AttributeEntry[]) => {
    setFormState((prev) => (prev ? { ...prev, attributes: updater(prev.attributes) } : prev));
  };

  const mutateTraits = (updater: (current: TraitEntry[]) => TraitEntry[]) => {
    setFormState((prev) => (prev ? { ...prev, traits: updater(prev.traits) } : prev));
  };

  const mutateAltForms = (updater: (current: AltFormEntry[]) => AltFormEntry[]) => {
    setFormState((prev) => (prev ? { ...prev, altForms: updater(prev.altForms) } : prev));
  };

  return (
    <section className="passport">
      <header className="passport__header">
        <div>
          <h1>Cosmic Passport</h1>
          <p>Capture every traveler, alternate form, and computed stat for your chain.</p>
        </div>
        <div className="passport__header-actions">
          <button type="button" onClick={handleCreate} disabled={upsertMutation.isPending}>
            {upsertMutation.isPending ? "Saving…" : "New Profile"}
          </button>
          <button
            type="button"
            className="passport__danger"
            onClick={handleDelete}
            disabled={!selectedId || deleteMutation.isPending}
          >
            Delete
          </button>
        </div>
      </header>

      <div className="passport__body">
        <aside className="passport__list">
          <h2>Profiles</h2>
          {profilesQuery.isLoading && <p className="passport__empty">Loading…</p>}
          {profilesQuery.isError && <p className="passport__empty">Failed to load profiles.</p>}
          {!profilesQuery.isLoading && !(profilesQuery.data?.length ?? 0) && (
            <p className="passport__empty">Create a profile to begin.</p>
          )}
          <ul>
            {profilesQuery.data?.map((profile) => (
              <li key={profile.id}>
                <button
                  type="button"
                  className={profile.id === selectedId ? "passport__list-item passport__list-item--active" : "passport__list-item"}
                  onClick={() => setSelectedId(profile.id)}
                >
                  <strong>{profile.name || "Unnamed Traveler"}</strong>
                  {(profile.alias || profile.species) && (
                    <span>{[profile.alias, profile.species].filter(Boolean).join(" • ")}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="passport__detail">
          {formState ? (
            <>
              <form
                className="passport__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSave();
                }}
              >
                <div className="passport__grid">
                  <label>
                    <span>Name</span>
                    <input
                      value={formState.name}
                      onChange={(event) =>
                        setFormState((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Alias</span>
                    <input
                      value={formState.alias}
                      onChange={(event) =>
                        setFormState((prev) => (prev ? { ...prev, alias: event.target.value } : prev))
                      }
                    />
                  </label>
                  <label>
                    <span>Species</span>
                    <input
                      value={formState.species}
                      onChange={(event) =>
                        setFormState((prev) => (prev ? { ...prev, species: event.target.value } : prev))
                      }
                    />
                  </label>
                  <label>
                    <span>Homeland</span>
                    <input
                      value={formState.homeland}
                      onChange={(event) =>
                        setFormState((prev) => (prev ? { ...prev, homeland: event.target.value } : prev))
                      }
                    />
                  </label>
                </div>

                <label>
                  <span>Biography</span>
                  <textarea
                    rows={4}
                    value={formState.biography}
                    onChange={(event) =>
                      setFormState((prev) => (prev ? { ...prev, biography: event.target.value } : prev))
                    }
                  />
                </label>

                <label>
                  <span>Personal Notes</span>
                  <textarea
                    rows={3}
                    value={formState.notes}
                    onChange={(event) =>
                      setFormState((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                    }
                  />
                </label>

                <section className="passport__section">
                  <header>
                    <h3>Attributes</h3>
                    <button type="button" onClick={() => mutateAttributes((entries) => [...entries, { id: createLocalId(), key: "", value: "" }])}>
                      Add Attribute
                    </button>
                  </header>
                  <div className="passport__repeat">
                    {formState.attributes.map((entry) => (
                      <div key={entry.id} className="passport__repeat-row">
                        <input
                          placeholder="Attribute"
                          value={entry.key}
                          onChange={(event) =>
                            mutateAttributes((entries) =>
                              entries.map((item) =>
                                item.id === entry.id ? { ...item, key: event.target.value } : item
                              )
                            )
                          }
                        />
                        <input
                          placeholder="Value"
                          value={entry.value}
                          onChange={(event) =>
                            mutateAttributes((entries) =>
                              entries.map((item) =>
                                item.id === entry.id ? { ...item, value: event.target.value } : item
                              )
                            )
                          }
                        />
                        <button
                          type="button"
                          onClick={() => mutateAttributes((entries) => entries.filter((item) => item.id !== entry.id))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="passport__section">
                  <header>
                    <h3>Traits & Abilities</h3>
                    <button type="button" onClick={() => mutateTraits((entries) => [...entries, { id: createLocalId(), name: "", description: "" }])}>
                      Add Trait
                    </button>
                  </header>
                  <div className="passport__repeat">
                    {formState.traits.map((entry) => (
                      <div key={entry.id} className="passport__repeat-row passport__repeat-row--stacked">
                        <div className="passport__repeat-stack">
                          <input
                            placeholder="Trait"
                            value={entry.name}
                            onChange={(event) =>
                              mutateTraits((entries) =>
                                entries.map((item) =>
                                  item.id === entry.id ? { ...item, name: event.target.value } : item
                                )
                              )
                            }
                          />
                          <textarea
                            rows={2}
                            placeholder="Description"
                            value={entry.description}
                            onChange={(event) =>
                              mutateTraits((entries) =>
                                entries.map((item) =>
                                  item.id === entry.id
                                    ? { ...item, description: event.target.value }
                                    : item
                                )
                              )
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => mutateTraits((entries) => entries.filter((item) => item.id !== entry.id))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="passport__section">
                  <header>
                    <h3>Alternate Forms</h3>
                    <button type="button" onClick={() => mutateAltForms((entries) => [...entries, { id: createLocalId(), name: "", summary: "" }])}>
                      Add Form
                    </button>
                  </header>
                  <div className="passport__repeat">
                    {formState.altForms.map((entry) => (
                      <div key={entry.id} className="passport__repeat-row passport__repeat-row--stacked">
                        <div className="passport__repeat-stack">
                          <input
                            placeholder="Form Name"
                            value={entry.name}
                            onChange={(event) =>
                              mutateAltForms((entries) =>
                                entries.map((item) =>
                                  item.id === entry.id ? { ...item, name: event.target.value } : item
                                )
                              )
                            }
                          />
                          <textarea
                            rows={2}
                            placeholder="Summary"
                            value={entry.summary}
                            onChange={(event) =>
                              mutateAltForms((entries) =>
                                entries.map((item) =>
                                  item.id === entry.id
                                    ? { ...item, summary: event.target.value }
                                    : item
                                )
                              )
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => mutateAltForms((entries) => entries.filter((item) => item.id !== entry.id))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="passport__form-actions">
                  <button type="submit" disabled={upsertMutation.isPending}>
                    {upsertMutation.isPending ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>

              <DerivedSummary form={formState} />
            </>
          ) : (
            <div className="passport__empty-state">
              <p>Select or create a profile to begin editing.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CosmicPassport;
