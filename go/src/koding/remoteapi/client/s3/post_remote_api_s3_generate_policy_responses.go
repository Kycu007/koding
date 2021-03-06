package s3

// This file was generated by the swagger tool.
// Editing this file might prove futile when you re-run the swagger generate command

import (
	"fmt"
	"io"

	"github.com/go-openapi/runtime"

	strfmt "github.com/go-openapi/strfmt"

	"koding/remoteapi/models"
)

// PostRemoteAPIS3GeneratePolicyReader is a Reader for the PostRemoteAPIS3GeneratePolicy structure.
type PostRemoteAPIS3GeneratePolicyReader struct {
	formats strfmt.Registry
}

// ReadResponse reads a server response into the received o.
func (o *PostRemoteAPIS3GeneratePolicyReader) ReadResponse(response runtime.ClientResponse, consumer runtime.Consumer) (interface{}, error) {
	switch response.Code() {

	case 200:
		result := NewPostRemoteAPIS3GeneratePolicyOK()
		if err := result.readResponse(response, consumer, o.formats); err != nil {
			return nil, err
		}
		return result, nil

	case 401:
		result := NewPostRemoteAPIS3GeneratePolicyUnauthorized()
		if err := result.readResponse(response, consumer, o.formats); err != nil {
			return nil, err
		}
		return nil, result

	default:
		return nil, runtime.NewAPIError("unknown error", response, response.Code())
	}
}

// NewPostRemoteAPIS3GeneratePolicyOK creates a PostRemoteAPIS3GeneratePolicyOK with default headers values
func NewPostRemoteAPIS3GeneratePolicyOK() *PostRemoteAPIS3GeneratePolicyOK {
	return &PostRemoteAPIS3GeneratePolicyOK{}
}

/*PostRemoteAPIS3GeneratePolicyOK handles this case with default header values.

Request processed successfully
*/
type PostRemoteAPIS3GeneratePolicyOK struct {
	Payload *models.DefaultResponse
}

func (o *PostRemoteAPIS3GeneratePolicyOK) Error() string {
	return fmt.Sprintf("[POST /remote.api/S3.generatePolicy][%d] postRemoteApiS3GeneratePolicyOK  %+v", 200, o.Payload)
}

func (o *PostRemoteAPIS3GeneratePolicyOK) readResponse(response runtime.ClientResponse, consumer runtime.Consumer, formats strfmt.Registry) error {

	o.Payload = new(models.DefaultResponse)

	// response payload
	if err := consumer.Consume(response.Body(), o.Payload); err != nil && err != io.EOF {
		return err
	}

	return nil
}

// NewPostRemoteAPIS3GeneratePolicyUnauthorized creates a PostRemoteAPIS3GeneratePolicyUnauthorized with default headers values
func NewPostRemoteAPIS3GeneratePolicyUnauthorized() *PostRemoteAPIS3GeneratePolicyUnauthorized {
	return &PostRemoteAPIS3GeneratePolicyUnauthorized{}
}

/*PostRemoteAPIS3GeneratePolicyUnauthorized handles this case with default header values.

Unauthorized request
*/
type PostRemoteAPIS3GeneratePolicyUnauthorized struct {
	Payload *models.UnauthorizedRequest
}

func (o *PostRemoteAPIS3GeneratePolicyUnauthorized) Error() string {
	return fmt.Sprintf("[POST /remote.api/S3.generatePolicy][%d] postRemoteApiS3GeneratePolicyUnauthorized  %+v", 401, o.Payload)
}

func (o *PostRemoteAPIS3GeneratePolicyUnauthorized) readResponse(response runtime.ClientResponse, consumer runtime.Consumer, formats strfmt.Registry) error {

	o.Payload = new(models.UnauthorizedRequest)

	// response payload
	if err := consumer.Consume(response.Body(), o.Payload); err != nil && err != io.EOF {
		return err
	}

	return nil
}
