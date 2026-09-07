import {
  Description,
  DomainName,
  OptionalField,
} from '../../common/validation.js';

export class UpdateGenreDto {
  @OptionalField()
  @DomainName()
  name?: string;

  @OptionalField()
  @Description()
  description?: string;
}
