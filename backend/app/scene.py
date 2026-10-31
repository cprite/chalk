from typing import Annotated, Literal, Union
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter


class CommonBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confidence: float = Field(ge=0.0, le=1.0)
    assumptions: list[Annotated[str, Field(max_length=200)]] = Field(max_length=8)
    gravity: float = Field(gt=0.0, le=30.0)


class InclineScene(CommonBase):
    scenario: Literal["incline"] = "incline"
    body: Literal["block", "ball"]
    mass: float = Field(gt=0.0, le=1000.0)
    angle_deg: float = Field(gt=0.0, lt=90.0)
    length: float = Field(gt=0.0, le=100.0)
    friction: float = Field(ge=0.0, le=2.0)


class ProjectileScene(CommonBase):
    scenario: Literal["projectile"] = "projectile"
    mass: float = Field(gt=0.0, le=1000.0)
    speed: float = Field(gt=0.0, le=200.0)
    angle_deg: float = Field(ge=0.0, le=90.0)
    height: float = Field(ge=0.0, le=100.0)


class PendulumScene(CommonBase):
    scenario: Literal["pendulum"] = "pendulum"
    mass: float = Field(gt=0.0, le=1000.0)
    length: float = Field(gt=0.0, le=50.0)
    angle_deg: float = Field(gt=0.0, le=60.0)


class Collision1DScene(CommonBase):
    scenario: Literal["collision_1d"] = "collision_1d"
    mass_a: float = Field(gt=0.0, le=1000.0)
    mass_b: float = Field(gt=0.0, le=1000.0)
    velocity_a: float = Field(ge=-100.0, le=100.0)
    velocity_b: float = Field(ge=-100.0, le=100.0)
    restitution: float = Field(ge=0.0, le=1.0)


SceneSpec = Annotated[
    Union[InclineScene, ProjectileScene, PendulumScene, Collision1DScene],
    Field(discriminator="scenario"),
]

SceneAdapter = TypeAdapter(SceneSpec)
