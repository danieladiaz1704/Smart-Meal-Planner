from pydantic import BaseModel, Field
from typing import List, Optional, Literal


class MealPlanRequest(BaseModel):
    calories: int = Field(..., ge=800, le=6000)
    meals_per_day: int = Field(..., ge=1, le=6)
    days: int = Field(1, ge=1, le=14)

    diet_type: Literal["vegetarian", "non-vegetarian"] = "non-vegetarian"
    goal: Literal["lose_weight", "maintain", "gain_muscle"] = "maintain"

    allergies: List[str] = Field(default_factory=list)

    exclude_ultra_processed: bool = Field(False)
    variety: bool = Field(True)


class ReplaceMealRequest(BaseModel):
    # Same global constraints as planner:
    calories: int = Field(..., ge=800, le=6000)
    meals_per_day: int = Field(..., ge=1, le=6)
    diet_type: Literal["vegetarian", "non-vegetarian"] = "non-vegetarian"
    goal: Literal["lose_weight", "maintain", "gain_muscle"] = "maintain"
    allergies: List[str] = Field(default_factory=list)
    exclude_ultra_processed: bool = Field(False)
    variety: bool = Field(True)

    # What to replace:
    day: int = Field(..., ge=1, le=14)
    slot: Literal["breakfast", "lunch", "dinner", "snack", "snack2", "snack3"] = "lunch"
    target_meal_calories: Optional[float] = None

    # Avoid repeats:
    exclude_recipe_ids: List[int] = Field(default_factory=list)
