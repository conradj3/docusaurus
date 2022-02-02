/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Joi, URISchema} from '@docusaurus/utils-validation';
import type {
  SidebarItemConfig,
  SidebarCategoriesShorthand,
  SidebarItemBase,
  SidebarItemAutogenerated,
  SidebarItemDoc,
  SidebarItemLink,
  SidebarItemCategoryConfig,
  SidebarItemCategoryLink,
  SidebarsConfig,
  SidebarItemCategoryLinkDoc,
  SidebarItemCategoryLinkGeneratedIndex,
} from './types';
import {isCategoriesShorthand} from './utils';
import type {CategoryMetadataFile} from './generator';

// NOTE: we don't add any default values during validation on purpose!
// Config types are exposed to users for typechecking and we use the same type
// in normalization

const sidebarItemBaseSchema = Joi.object<SidebarItemBase>({
  className: Joi.string(),
  customProps: Joi.object().unknown(),
});

const sidebarItemAutogeneratedSchema =
  sidebarItemBaseSchema.append<SidebarItemAutogenerated>({
    type: 'autogenerated',
    dirName: Joi.string()
      .required()
      .pattern(/^[^/](?:.*[^/])?$/)
      .message(
        '"dirName" must be a dir path relative to the docs folder root, and should not start or end with slash',
      ),
  });

const sidebarItemDocSchema = sidebarItemBaseSchema.append<SidebarItemDoc>({
  type: Joi.string().valid('doc', 'ref').required(),
  id: Joi.string().required(),
  label: Joi.string(),
});

const sidebarItemLinkSchema = sidebarItemBaseSchema.append<SidebarItemLink>({
  type: 'link',
  href: URISchema.required(),
  label: Joi.string()
    .required()
    .messages({'any.unknown': '"label" must be a string'}),
});

const sidebarItemCategoryLinkSchema = Joi.object<SidebarItemCategoryLink>()
  .allow(null)
  .when('.type', {
    switch: [
      {
        is: 'doc',
        then: Joi.object<SidebarItemCategoryLinkDoc>({
          type: 'doc',
          id: Joi.string().required(),
        }),
      },
      {
        is: 'generated-index',
        then: Joi.object<SidebarItemCategoryLinkGeneratedIndex>({
          type: 'generated-index',
          slug: Joi.string().optional(),
          // This one is not in the user config, only in the normalized version
          // permalink: Joi.string().optional(),
          title: Joi.string().optional(),
          description: Joi.string().optional(),
          image: Joi.string().optional(),
          keywords: [Joi.string(), Joi.array().items(Joi.string())],
        }),
      },
      {
        is: Joi.string().required(),
        then: Joi.forbidden().messages({
          'any.unknown': 'Unknown sidebar category link type "{.type}".',
        }),
      },
    ],
  })
  .id('sidebarCategoryLinkSchema');

const sidebarItemCategorySchema =
  sidebarItemBaseSchema.append<SidebarItemCategoryConfig>({
    type: 'category',
    label: Joi.string()
      .required()
      .messages({'any.unknown': '"label" must be a string'}),
    // TODO: Joi doesn't allow mutual recursion. See https://github.com/sideway/joi/issues/2611
    items: Joi.array()
      .required()
      .messages({'any.unknown': '"items" must be an array'}), // .items(Joi.link('#sidebarItemSchema')),
    link: sidebarItemCategoryLinkSchema,
    collapsed: Joi.boolean().messages({
      'any.unknown': '"collapsed" must be a boolean',
    }),
    collapsible: Joi.boolean().messages({
      'any.unknown': '"collapsible" must be a boolean',
    }),
  });

const sidebarItemSchema: Joi.Schema<SidebarItemConfig> = Joi.object()
  .when('.type', {
    switch: [
      {is: 'link', then: sidebarItemLinkSchema},
      {
        is: Joi.string().valid('doc', 'ref').required(),
        then: sidebarItemDocSchema,
      },
      {is: 'autogenerated', then: sidebarItemAutogeneratedSchema},
      {is: 'category', then: sidebarItemCategorySchema},
      {
        is: Joi.any().required(),
        then: Joi.forbidden().messages({
          'any.unknown': 'Unknown sidebar item type "{.type}".',
        }),
      },
    ],
  })
  .id('sidebarItemSchema');

function validateSidebarItem(item: unknown): asserts item is SidebarItemConfig {
  if (typeof item === 'string') {
    return;
  }
  // TODO: remove once with proper Joi support
  // Because we can't use Joi to validate nested items (see above), we do it
  // manually
  if (isCategoriesShorthand(item as SidebarItemConfig)) {
    Object.values(item as SidebarCategoriesShorthand).forEach((category) =>
      category.forEach(validateSidebarItem),
    );
  } else {
    Joi.assert(item, sidebarItemSchema);

    if ((item as SidebarItemCategoryConfig).type === 'category') {
      (item as SidebarItemCategoryConfig).items.forEach(validateSidebarItem);
    }
  }
}

export function validateSidebars(
  sidebars: unknown,
): asserts sidebars is SidebarsConfig {
  Object.values(sidebars as SidebarsConfig).forEach((sidebar) => {
    if (Array.isArray(sidebar)) {
      sidebar.forEach(validateSidebarItem);
    } else {
      validateSidebarItem(sidebar);
    }
  });
}

const categoryMetadataFileSchema = Joi.object<CategoryMetadataFile>({
  label: Joi.string(),
  position: Joi.number(),
  collapsed: Joi.boolean(),
  collapsible: Joi.boolean(),
  className: Joi.string(),
  link: sidebarItemCategoryLinkSchema,
});

export function validateCategoryMetadataFile(
  unsafeContent: unknown,
): CategoryMetadataFile {
  return Joi.attempt(unsafeContent, categoryMetadataFileSchema);
}