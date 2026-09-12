import {
  Description,
  DomainName,
  OptionalField,
} from '../../common/validation.js';

export class UpdateCategoryDto {
  @OptionalField()
  @DomainName()
  name?: string;

  @OptionalField()
  @Description()
  description?: string;
}
