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


class SpringScene(CommonBase):
    scenario: Literal["spring"] = "spring"
    mass: float = Field(gt=0.0, le=1000.0)
    spring_constant: float = Field(gt=0.0, le=50000.0)
    spring_count: int = Field(default=1, ge=1, le=10)
    arrangement: Literal["series", "parallel", "single"] = "series"
    amplitude: float = Field(default=0.35, gt=0.0, le=5.0)
    k1: float = Field(default=0.0, ge=0.0, le=50000.0)
    k2: float = Field(default=0.0, ge=0.0, le=50000.0)


class GenerativeObject(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    type: str  # "block", "sphere", "spring", "string", "anchor", "ramp", "track", "bob"
    label: str = ""
    mass: float = 1.0
    k: float = 0.0
    position: list[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0])
    connects: list[str] = Field(default_factory=list)
    is_fixed: bool = False


class GenerativeScene(CommonBase):
    scenario: Literal["generative"] = "generative"
    title: str = Field(default="Custom Physics Apparatus", max_length=150)
    primary_law: str = Field(default="Newtonian Mechanics", max_length=150)
    formula: str = Field(default="", max_length=200)
    mass: float = Field(default=1.0, gt=0.0, le=1000.0)
    objects: list[GenerativeObject] = Field(default_factory=list)


SceneSpec = Annotated[
    Union[InclineScene, ProjectileScene, PendulumScene, Collision1DScene, SpringScene, GenerativeScene],
    Field(discriminator="scenario"),
]

SceneAdapter = TypeAdapter(SceneSpec)
