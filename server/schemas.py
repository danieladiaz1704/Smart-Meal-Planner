from pydantic import BaseModel, Field
from typing import List, Optional, Literal


# -----------------------------
# ENUMS / TYPES
# -----------------------------
DietType = Literal["vegan", "vegetarian", "non-vegetarian"]
GoalType = Literal["lose_weight", "maintain", "gain_muscle"]

PrepTimePreference = Literal["any", "quick", "moderate"]
MacroPreference = Literal["balanced", "high_protein", "high_carb", "lower_carb"]

MealType = Literal["breakfast", "lunch", "dinner", "snack"]


# -----------------------------
# MAIN MEAL PLAN REQUEST
# -----------------------------
class MealPlanRequest(BaseModel):
    # Core inputs
    calories: int = Field(..., ge=800, le=6000)
    meals_per_day: int = Field(..., ge=1, le=6)
    days: int = Field(1, ge=1, le=14)

    # Diet & goal
    diet_type: DietType = "non-vegetarian"
    goal: GoalType = "maintain"

    # Restrictions
    allergies: List[str] = Field(default_factory=list)
    exclude_ultra_processed: bool = Field(False)

    # General behavior
    variety: bool = Field(True)

    # Preferences (old system - still supported)
    prep_time_preference: PrepTimePreference = "any"
    macro_preference: MacroPreference = "balanced"

    # -----------------------------
    # 🔥 NEW AI QUESTIONNAIRE INPUTS
    # -----------------------------
    likes: List[str] = Field(default_factory=list)
    dislikes: List[str] = Field(default_factory=list)

    favorite_meal_types: List[MealType] = Field(default_factory=list)
    favorite_proteins: List[str] = Field(default_factory=list)
    # Optional numeric preference (used for scoring)
    preferred_prep_time: Optional[int] = None


# -----------------------------
# REPLACE MEAL REQUEST
# -----------------------------
class ReplaceMealRequest(BaseModel):
    # Same global constraints
    calories: int = Field(..., ge=800, le=6000)
    meals_per_day: int = Field(..., ge=1, le=6)

    diet_type: DietType = "non-vegetarian"
    goal: GoalType = "maintain"

    allergies: List[str] = Field(default_factory=list)
    exclude_ultra_processed: bool = Field(False)

    variety: bool = Field(True)

    prep_time_preference: PrepTimePreference = "any"
    macro_preference: MacroPreference = "balanced"

   
    likes: List[str] = Field(default_factory=list)
    dislikes: List[str] = Field(default_factory=list)
    favorite_meal_types: List[MealType] = Field(default_factory=list)
    favorite_proteins: List[str] = Field(default_factory=list)
    preferred_prep_time: Optional[int] = None

    # What to replace
    day: int = Field(..., ge=1, le=14)

    slot: Literal[
        "breakfast", "lunch", "dinner",
        "snack", "snack2", "snack3"
    ] = "lunch"

    target_meal_calories: Optional[float] = None

    # Avoid duplicates
    exclude_recipe_ids: List[int] = Field(default_factory=list)