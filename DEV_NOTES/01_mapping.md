<!--
Bloodawn

Copyright (c) 2025 Bloodawn

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
-->
# C# ? TypeScript Model Mapping

| C# Class | Proposed TS Interface | Key Fields ? TS Types | Enums / Nullability | Primary Usage |
| --- | --- | --- | --- | --- |
| `DocumentDetail` | `DocumentDetail` | `name: string; version: string; source: string; author: string` | non-null strings | Base metadata for `Jump`, used in document headers across UI/export |
| `Jump` | `Jump` | `id?: string; name: string; version: string; source: string; author: string; originDetails: OriginDetail[]; miscOriginCategories: string[]; durationDays: number; durationMonths: number; durationYears: number; jumpNumber: number; skipNumber: boolean; originDiscounts: boolean; originPerkFreebieThreshold: number; originItemFreebieThreshold: number; build: JumpBuild[]; currencies: Currency[]; purchaseTypes: PurchaseType[]; isGauntlet: boolean` | bool?boolean; ints?number; arrays non-null | Core jump state; edited in `JumpchainOverviewViewModel`, exported via `ExportViewModel`, persisted in `SaveFile` |
| `JumpBuild` | `JumpBuild` | `pointStipend: number[]; purchaseTypeStipends: number[]; originIndex: number; species: OriginDetail; location: OriginDetail; miscOriginDetails: OriginDetail[]; age: number; ageCost: number; gender: string; genderCost: number; purchase: Purchase[]; companionPurchase: CompanionPurchase[]; drawbackSelection: Drawback[]; scenarioSelection: Drawback[]; warehouseInvestment: number; bodyModInvestment: number; bankedPoints: number; bankUsage: number; currentBank: number` | nested objects non-null; lists default empty | Per-character build details; edited in overview tabs; consumed in exports and statistics |
| `Purchase` | `Purchase` | `name: string; cost: number; displayCost: number; discountEnabled: boolean; freebieEnabled: boolean; associatedOriginIndex: number; category: string; typeIndex: number; bodyModAddition: boolean; isTemporary: boolean; description: string; attributes: PurchaseAttribute[]; sourceJump: string; sourceCharacter: string` | Nullability: strings default empty; list default [] | Represents perks/items/etc; stored within `JumpBuild.purchase`; affects budget calculations and exports |
| `PurchaseAttribute` | `PurchaseAttribute` | `name: string; type: string; category: string; value: number; rank: Rank; sourcePurchase: string; sourceJump: string; typeList: string[]; attributeCategoryList: string[]; skillCategoryList: string[]; specialCategoryList: string[]` | `Rank` ? enum mirroring `AttributeCalculationClass.RankList`; arrays default [] | Captures granted traits; referenced in character passports and attribute math |
| `CompanionPurchase` | `CompanionPurchase` | `name: string; cost: number; displayCost: number; discountEnabled: boolean; freebieEnabled: boolean; description: string; companionImportDetails: CompanionImportDetail[]` | booleans default false | Manages companion import options per jump; used in companion tabs and exports |
| `CompanionImportDetailClass` | `CompanionImportDetail` | `companionName: string; companionSelected: boolean; companionOptionValue: number` | non-null | Tracks stipend/selection for each companion slot |
| `Drawback` | `Drawback` | `name: string; value: number; description: string; reward: string` | ints?number | Selected drawbacks/scenarios; used in budget calculations and export sections |
| `Currency` | `Currency` | `currencyName: string; currencyAbbreviation: string; currencyBudget: number` | none | Jump-level currencies; drives budgeting UI and export formatting |
| `PurchaseType` | `PurchaseType` | `type: string; currencyIndex: number; currencyName: string; isItemType: boolean` | bool?boolean | Differentiates perks vs items vs custom purchases; referenced in UI filters and export grouping |
| `OriginDetail` | `OriginDetail` | `name: string; category: string; cost: number; description: string` | ints?number | Origin/location/species options; used within jump setup and export |
| `Character` | `Character` | `name: string; alias: string; gender: string; age: number; trueAge: number; heightFeet: number; heightInches: number; heightMeters: number; weightPounds: number; weightKilograms: number; race: string; species: string; physicalDescription: string; personality: string; homeworld: string; firstJump: number; likes: string; dislikes: string; hobbies: string; quirks: string; goals: string; altForms: AltForm[]; attributes: ProfileAttribute[]; skills: ProfileAttribute[]; boosters: Booster[]; bodyMod: BodyModUniversal` | Many nested models (AltForm, ProfileAttribute etc.) also require interfaces; numeric defaults 0 | Managed in Cosmic Passport; exported for profiles and stats |
| `Options` | `Options` | `cosmicWarehouseSetting: CosmicWarehouseSupplement; bodyModSetting: BodyModSupplement; drawbackSupplementSetting: DrawbackSupplement; defaultBudget: number; defaultItemStipend: number; originDiscounts: boolean; defaultPerkFreebieThreshold: number; defaultItemFreebieThreshold: number; allowPointBank: boolean; allowGauntletBank: boolean; allowSupplementedJumpBankSharing: boolean; allowCompanionsBank: boolean; pointBankLimit: number; companionBankLimit: number; exportOptions: ExportOptions` | Enums: `CosmicWarehouseSupplement`, `BodyModSupplement`, `DrawbackSupplement`; all non-null | Global configuration; edited in Jumpchain Options, persisted in `SaveFile` |
| `ExportOptions` | `ExportOptions` | `budgetFormat: number; reverseBudgetFormat: boolean; sectionSeparator: string; budgetEnclosingFormat: string; budgetSeparatorFormat: string; buildSectionList: ExportFormatToggle[]; profileSectionList: ExportFormatToggle[]; profileSubsectionList: ExportFormatToggle[]; genericWarehouseSectionList: ExportFormatToggle[]; personalRealitySectionList: ExportFormatToggle[]; bodyModSectionList: ExportFormatToggle[]; drawbackSupplementSectionList: ExportFormatToggle[]; companionBuilds: boolean; exportMode: 'Generic'|'BBCode'|'Markdown'; genericFormattingOptions: ExportFormatToggle[]; bbcodeFormattingOptions: ExportFormatToggle[]; markdownFormattingOptions: ExportFormatToggle[]` | Strings non-null; arrays default [] | Drives export view toggles across build/profile/warehouse/body mod outputs |
| `ExportFormatToggle` | `ExportFormatToggle` | `name: string; enabled: boolean` | bool?boolean | Shared toggle rows in options UI |
| `SaveFile` | `SaveFile` | `jumpList: Jump[]; characterList: Character[]; options: Options; genericBodyMod: GenericBodyMod; sbBodyMod: SBBodyMod; essentialBodyMod: EssentialBodyMod; genericWarehouse: GenericWarehouse; personalReality: PersonalReality; genericDrawbackSupplement: GenericDrawbackSupplement; universalDrawbackSupplement: UniversalDrawbackSupplement; uuSupplement: UUSupplement; userPerkCategoryList: string[]; userItemCategoryList: string[]; perkCategoryList: string[]; itemCategoryList: string[]; saveVersion: number` | Many nested supplements require dedicated interfaces; lists default [] | Root persisted object; loaded on startup, drives entire app state and migrations |
| `AttributeCalculationClass.RankList` | `enum Rank` | replicate literal labels (`None`, `F`, `FPlus`, ... `Z_APlusPlusPlus`) with numeric values | required for `PurchaseAttribute.rank` and attribute math | Used by attribute calculators, statistics, and display helpers |
