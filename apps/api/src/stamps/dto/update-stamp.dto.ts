import {
  Description,
  DomainName,
  OptionalField,
} from '../../common/validation.js';

export class UpdateStampDto {
  @OptionalField()
  @DomainName()
  name?: string;

  @OptionalField()
  @Description()
  description?: string;
}
