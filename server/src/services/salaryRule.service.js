/**
 * @fileoverview Salary Rule Service — Business logic layer.
 *
 * Business rules (from business-logic.md §4):
 *  - code must be unique within its structure
 *  - sequence must be unique within its structure
 *  - If rule_type = 'percentage': base_rule_id required, must be same structure,
 *    and base_rule.sequence MUST be < this rule's sequence
 *  - Cannot delete a rule that other rules depend on (base_rule_id) → 409
 */

import * as ruleRepo from '#repositories/salaryRule.repo.js';
import * as structureRepo from '#repositories/salaryStructure.repo.js';
import { logger } from '#config/logger.js';
import { NotFoundError, ConflictError, BadRequestError } from '#lib/errors.js';

const validateDependency = async (structureId, baseRuleId, sequence) => {
    if (!baseRuleId) return;
    const baseRule = await ruleRepo.findById(baseRuleId);
    if (!baseRule) throw new BadRequestError(`Base rule with id "${baseRuleId}" not found`);
    if (baseRule.structure_id !== structureId) {
        throw new BadRequestError('base_rule_id must reference a rule within the same structure');
    }
    if (baseRule.sequence >= sequence) {
        throw new BadRequestError(
            `Dependent rule must have a higher sequence than its base rule (base sequence: ${baseRule.sequence})`
        );
    }
};

export const getByStructure = async (structureId) => {
    const structure = await structureRepo.findById(structureId);
    if (!structure) throw new NotFoundError(`Salary structure with id "${structureId}" not found`);
    return ruleRepo.findByStructure(structureId);
};

export const getById = async (id) => {
    const row = await ruleRepo.findById(id);
    if (!row) throw new NotFoundError(`Salary rule with id "${id}" not found`);
    return row;
};

export const create = async (structureId, data) => {
    const structure = await structureRepo.findById(structureId);
    if (!structure) throw new NotFoundError(`Salary structure with id "${structureId}" not found`);

    // Unique code within structure
    const codeConflict = await ruleRepo.findByCode(structureId, data.code);
    if (codeConflict) throw new ConflictError(`Rule code "${data.code}" already exists in this structure`);

    // Unique sequence within structure
    const seqConflict = await ruleRepo.findBySequence(structureId, data.sequence);
    if (seqConflict) throw new ConflictError(`Sequence ${data.sequence} is already taken in this structure`);

    // Percentage rules: validate base_rule dependency ordering
    if (data.rule_type === 'percentage') {
        if (!data.base_rule_id) throw new BadRequestError('base_rule_id is required for percentage rules');
        await validateDependency(structureId, data.base_rule_id, data.sequence);
    }

    return ruleRepo.create(structureId, data);
};

export const update = async (id, fields) => {
    const existing = await ruleRepo.findById(id);
    if (!existing) throw new NotFoundError(`Salary rule with id "${id}" not found`);

    const structureId = existing.structure_id;

    if (fields.code) {
        const conflict = await ruleRepo.findByCode(structureId, fields.code, id);
        if (conflict) throw new ConflictError(`Rule code "${fields.code}" already exists in this structure`);
    }

    const newSequence = fields.sequence ?? existing.sequence;
    if (fields.sequence !== undefined) {
        const seqConflict = await ruleRepo.findBySequence(structureId, fields.sequence, id);
        if (seqConflict) throw new ConflictError(`Sequence ${fields.sequence} is already taken in this structure`);
    }

    const newBaseRuleId = fields.base_rule_id ?? existing.base_rule_id;
    const newRuleType   = fields.rule_type   ?? existing.rule_type;

    if (newRuleType === 'percentage' && newBaseRuleId) {
        await validateDependency(structureId, newBaseRuleId, newSequence);
    }

    const updated = await ruleRepo.update(id, fields);
    if (!updated) throw new NotFoundError(`Salary rule with id "${id}" not found`);
    return updated;
};

export const remove = async (id) => {
    const existing = await ruleRepo.findById(id);
    if (!existing) throw new NotFoundError(`Salary rule with id "${id}" not found`);

    const hasDeps = await ruleRepo.hasDependentRules(id);
    if (hasDeps) {
        throw new ConflictError(
            `Cannot delete rule "${existing.name}" — other rules depend on it as their base rule`
        );
    }

    await ruleRepo.remove(id);
};
